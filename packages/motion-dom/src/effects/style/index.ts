import { transformGroups } from "../../animation/waapi/transforms/groups"
import { isCSSVar } from "../../render/dom/is-css-var"
import { readTransformValue } from "../../render/dom/parse-transform"
import { buildTransform } from "../../render/html/utils/build-transform"
import { nodeStore } from "../../render/store"
import { transformProps } from "../../render/utils/keys-transform"
import { isHTMLElement } from "../../utils/is-html-element"
import { isSVGElement } from "../../utils/is-svg-element"
import type { MotionNode } from "../../node/MotionNode"
import { MotionValue } from "../../value"
import { numberValueTypes } from "../../value/types/maps/number"
import { getValueAsType } from "../../value/types/utils/get-as-type"
import { createSelectorEffect } from "../utils/create-dom-effect"
import { createEffect } from "../utils/create-effect"

export const originProps = new Set(["originX", "originY", "originZ"])

/**
 * A latest value in its default unit, e.g. `originX: 50` -> `"50%"`.
 */
const styleValue = (node: MotionNode, key: string) =>
    getValueAsType(node.latestValues[key], numberValueTypes[key])

/**
 * The transforms record a transformTemplate is given. Without a
 * template nothing is written to it.
 */
const noTemplateTransforms = {}

/**
 * The function that writes `transform` from the node's independent
 * transforms (`x`, `scale` etc). Every transform key shares it.
 */
export const getTransformRender = (
    element: HTMLElement | SVGElement,
    node: MotionNode
) =>
    ((node.shared ||= {}).transform ||= () => {
        transformGroups.get(element)?.check()

        const { latestValues } = node

        /**
         * A `transform` value is written as any other style, and takes
         * the place of one built from independent transforms.
         */
        if (latestValues.transform) return

        const { transformTemplate } = node.getProps()
        const { style } = element

        style.transform = buildTransform(
            latestValues,
            transformTemplate ? {} : noTemplateTransforms,
            transformTemplate
        )

        /**
         * An SVG element's transforms are relative to its own box, with
         * the origin at its centre, as an HTML element's are.
         */
        if (!isHTMLElement(element) && element.tagName !== "svg") {
            style.transformBox ||
                latestValues.transformBox ||
                (style.transformBox = "fill-box")
            style.transformOrigin || (style.transformOrigin = "50% 50%")
        }
    })

export const addStyleValue = (
    element: HTMLElement | SVGElement,
    node: MotionNode,
    key: string,
    value?: MotionValue
) => {
    let render: VoidFunction
    let shared = false

    if (transformProps.has(key)) {
        render = getTransformRender(element, node)
        shared = true
    } else if (originProps.has(key)) {
        render = (node.shared ||= {}).origin ||= () => {
            const originX = styleValue(node, "originX") ?? "50%"
            const originY = styleValue(node, "originY") ?? "50%"
            const originZ = styleValue(node, "originZ") ?? 0
            element.style.transformOrigin = `${originX} ${originY} ${originZ}`
        }
        shared = true
    } else if (isCSSVar(key)) {
        render = () => {
            element.style.setProperty(key, node.latestValues[key] as string)
        }
    } else {
        render = () => {
            element.style[key as any] = styleValue(node, key) as string
        }
    }

    return node.set(key, value, render, shared)
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
 * a node with a direct `styleEffect()` call and with the element's motion
 * component, if it has one. The exported `styleEffect` is this wrapped to
 * also accept selectors.
 */
export const styleSubjectEffect = /*@__PURE__*/ createEffect(addStyleValue, {
    test: isStyleSubject,
    read: readStyleValue,
    nodes: nodeStore,
})

export const styleEffect =
    /*@__PURE__*/ createSelectorEffect(styleSubjectEffect)
