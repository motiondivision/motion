import { isCSSVar } from "../../render/dom/is-css-var"
import { readTransformValue } from "../../render/dom/parse-transform"
import {
    transformPropOrder,
    transformProps,
} from "../../render/utils/keys-transform"
import { isHTMLElement } from "../../utils/is-html-element"
import { isSVGElement } from "../../utils/is-svg-element"
import { MotionValue } from "../../value"
import { numberValueTypes } from "../../value/types/maps/number"
import { getValueAsType } from "../../value/types/utils/get-as-type"
import { MotionValueState } from "../MotionValueState"
import { createSelectorEffect } from "../utils/create-dom-effect"
import { createEffect } from "../utils/create-effect"
import { buildTransform } from "./transform"
import {
    buildIndependentTransforms,
    independentTransformHooks,
} from "../../render/html/utils/independent-transforms"

export const originProps = new Set(["originX", "originY", "originZ"])

/**
 * A bound value in its default unit, e.g. `originX: 50` -> `"50%"`.
 */
const styleValue = (state: MotionValueState, key: string) =>
    getValueAsType(state.get(key)?.get(), numberValueTypes[key])

/**
 * The bound transform values as a plain object, read by accelerated
 * transform animations.
 */
export const readTransformValues = (state?: MotionValueState) => {
    const values: Record<string, any> = {}
    if (!state) return values

    const { transformKeys = [], transformValues = {} } = state
    for (const key of transformKeys) values[key] = transformValues[key].get()

    const pathRotation = state.get("pathRotation")?.get()
    if (pathRotation !== undefined) values.pathRotation = pathRotation

    return values
}

export const addStyleValue = (
    element: HTMLElement | SVGElement,
    state: MotionValueState,
    key: string,
    value: MotionValue
) => {
    let render: VoidFunction | undefined = undefined
    let computed: MotionValue | undefined = undefined

    if (transformProps.has(key)) {
        if (key !== "pathRotation") {
            const keys = (state.transformKeys ??= [])
            ;(state.transformValues ??= {})[key] = value

            if (!keys.includes(key)) {
                keys.push(key)
                keys.sort(
                    (a, b) =>
                        transformPropOrder.indexOf(a) -
                        transformPropOrder.indexOf(b)
                )
            }
        }

        if (!state.get("transform")) {
            // If this is an HTML element, we need to set the transform-box to fill-box
            // to normalise the transform relative to the element's bounding box
            if (!isHTMLElement(element) && !state.get("transformBox")) {
                addStyleValue(
                    element,
                    state,
                    "transformBox",
                    new MotionValue("fill-box")
                )
            }

            state.set("transform", new MotionValue("none"), () => {
                if (state.independentTransforms) {
                    /**
                     * Moving an animation to the main thread sets its
                     * current value, so read the values again afterwards.
                     */
                    if (
                        independentTransformHooks.sync?.(
                            element,
                            readTransformValues(state)
                        )
                    ) {
                        buildIndependentTransforms(
                            readTransformValues(state),
                            element.style as any
                        )
                        return
                    }

                    /**
                     * No transform is accelerated any more, so render through
                     * the transform shorthand again.
                     */
                    state.independentTransforms = false
                    element.style.translate =
                        element.style.scale =
                        element.style.rotate =
                            "none"
                }

                element.style.transform = buildTransform(state)
            })
        }

        computed = state.get("transform")
    } else if (originProps.has(key)) {
        if (!state.get("transformOrigin")) {
            state.set("transformOrigin", new MotionValue(""), () => {
                const originX = styleValue(state, "originX") ?? "50%"
                const originY = styleValue(state, "originY") ?? "50%"
                const originZ = styleValue(state, "originZ") ?? 0
                element.style.transformOrigin = `${originX} ${originY} ${originZ}`
            })
        }

        computed = state.get("transformOrigin")
    } else if (isCSSVar(key)) {
        render = () => {
            element.style.setProperty(key, value.get() as string)
        }
    } else {
        render = () => {
            element.style[key as any] = getValueAsType(
                value.get(),
                numberValueTypes[key]
            ) as string
        }
    }

    return state.set(key, value, render, computed)
}

export type StyleSubject = HTMLElement | SVGElement

const isStyleSubject = (subject: unknown): subject is StyleSubject =>
    isHTMLElement(subject) || isSVGElement(subject)

/**
 * Reads the current value of a style from the element, as the initial
 * keyframe when `animate()` targets an element via this effect. Transforms
 * are parsed out of the computed matrix; everything else is the computed
 * style. Units aren't converted to match the target keyframes. A style
 * the browser can't report is 0, as a VisualElement reports it.
 */
export const readStyleValue = (element: StyleSubject, key: string) => {
    if (transformProps.has(key)) {
        return readTransformValue(element as HTMLElement, key)
    }

    const computedStyle = getComputedStyle(element)
    const value = isCSSVar(key)
        ? computedStyle.getPropertyValue(key)
        : computedStyle[key as any]

    return (typeof value === "string" && value.trim()) || 0
}

/**
 * The per-element effect `animate()` binds through, so HTML values share
 * state with a direct `styleEffect()` call. The exported `styleEffect`
 * is this wrapped to also accept selectors.
 */
export const styleSubjectEffect = /*@__PURE__*/ createEffect(addStyleValue, {
    test: isStyleSubject,
    read: readStyleValue,
})

export const styleEffect =
    /*@__PURE__*/ createSelectorEffect(styleSubjectEffect)
