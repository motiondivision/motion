import { isCSSVar } from "../../render/dom/is-css-var"
import { readTransformValue } from "../../render/dom/parse-transform"
import {
    transformPropOrder,
    transformProps,
} from "../../render/utils/keys-transform"
import { isHTMLElement } from "../../utils/is-html-element"
import { isSVGElement } from "../../utils/is-svg-element"
import { MotionValue } from "../../value"
import { MotionValueState } from "../MotionValueState"
import { createSelectorEffect } from "../utils/create-dom-effect"
import { createEffect } from "../utils/create-effect"
import { buildTransform } from "./transform"

const originProps = new Set(["originX", "originY", "originZ"])

export const addStyleValue = (
    element: HTMLElement | SVGElement,
    state: MotionValueState,
    key: string,
    value: MotionValue
) => {
    let render: VoidFunction | undefined = undefined
    let computed: MotionValue | undefined = undefined

    if (transformProps.has(key)) {
        const keys = (state.transformKeys ??= [])
        if (!keys.includes(key) && key !== "pathRotation") {
            keys.push(key)
            keys.sort(
                (a, b) =>
                    transformPropOrder.indexOf(a) -
                    transformPropOrder.indexOf(b)
            )
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
                element.style.transform = buildTransform(state)
            })
        }

        computed = state.get("transform")
    } else if (originProps.has(key)) {
        if (!state.get("transformOrigin")) {
            state.set("transformOrigin", new MotionValue(""), () => {
                const originX = state.latest.originX ?? "50%"
                const originY = state.latest.originY ?? "50%"
                const originZ = state.latest.originZ ?? 0
                element.style.transformOrigin = `${originX} ${originY} ${originZ}`
            })
        }

        computed = state.get("transformOrigin")
    } else if (isCSSVar(key)) {
        render = () => {
            element.style.setProperty(key, state.latest[key] as string)
        }
    } else {
        render = () => {
            element.style[key as any] = state.latest[key] as string
        }
    }

    return state.set(key, value, render, computed, !transformProps.has(key))
}

export type StyleSubject = HTMLElement | SVGElement

const isStyleSubject = (subject: unknown): subject is StyleSubject =>
    isHTMLElement(subject) || isSVGElement(subject)

/**
 * Reads the current value of a style from the element, as the initial
 * keyframe when `animate()` targets an element via this effect. Transforms
 * are parsed out of the computed matrix; everything else is the computed
 * style. Units aren't converted to match the target keyframes.
 */
export const readStyleValue = (element: StyleSubject, key: string) => {
    if (transformProps.has(key)) {
        return readTransformValue(element as HTMLElement, key)
    }

    const computedStyle = getComputedStyle(element)
    const value = isCSSVar(key)
        ? computedStyle.getPropertyValue(key)
        : computedStyle[key as any]

    return typeof value === "string" ? value.trim() || undefined : undefined
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

export const styleEffect = /*@__PURE__*/ createSelectorEffect(styleSubjectEffect)
