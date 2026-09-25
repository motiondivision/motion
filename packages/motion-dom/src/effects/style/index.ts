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

const originProps = new Set(["originX", "originY", "originZ"])

/**
 * A bound value in its default unit, e.g. `originX: 50` -> `"50%"`, or
 * undefined while suspended.
 */
const styleValue = (state: MotionValueState, key: string) =>
    getValueAsType(state.output(key), numberValueTypes[key])

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

            /**
             * Bases are the inline styles from before Motion writes them,
             * rendered while every value they're built from is suspended.
             */
            const base = element.style.transform
            state.set("transform", new MotionValue("none"), () => {
                element.style.transform = buildTransform(state) || base
            })
        }

        computed = state.get("transform")
    } else if (originProps.has(key)) {
        if (!state.get("transformOrigin")) {
            const base = element.style.transformOrigin
            state.set("transformOrigin", new MotionValue(""), () => {
                const originX = styleValue(state, "originX")
                const originY = styleValue(state, "originY")
                const originZ = styleValue(state, "originZ")
                element.style.transformOrigin =
                    (originX ?? originY ?? originZ) === undefined
                        ? base
                        : `${originX ?? "50%"} ${originY ?? "50%"} ${
                              originZ ?? 0
                          }`
            })
        }

        computed = state.get("transformOrigin")
    } else if (isCSSVar(key)) {
        const base = element.style.getPropertyValue(key)
        render = () => {
            element.style.setProperty(key, state.output(key, value, base))
        }
    } else {
        const base = element.style[key as any]
        render = () => {
            element.style[key as any] = getValueAsType(
                state.output(key, value, base),
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

export const styleEffect = /*@__PURE__*/ createSelectorEffect(styleSubjectEffect)
