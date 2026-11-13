import {
    markRepaint,
    transformGroups,
} from "../../animation/waapi/transforms/groups"
import { isCSSVar } from "../../render/dom/is-css-var"
import { acceleratedValues } from "../../animation/waapi/utils/accelerated-values"
import { readTransformValue } from "../../render/dom/parse-transform"
import { buildTransform } from "../../render/html/utils/build-transform"
import { nodeStore } from "../../render/store"
import { transformProps } from "../../render/utils/keys-transform"
import { isHTMLElement } from "../../utils/is-html-element"
import { isSVGElement } from "../../utils/is-svg-element"
import type { MotionNode, NodeRender } from "../../node/MotionNode"
import type { ResolvedValues } from "../../node/types"
import { MotionValue } from "../../value"
import { numberValueTypes } from "../../value/types/maps/number"
import { getValueAsType } from "../../value/types/utils/get-as-type"
import { createSelectorEffect } from "../utils/create-dom-effect"
import { createEffect } from "../utils/create-effect"
import { setStyle } from "./output"

/**
 * What a write function reads from: a node, or the values of a
 * component that's rendering before it has one.
 */
export interface RenderSource {
    latestValues: ResolvedValues
    shared?: { [name: string]: NodeRender }
    getProps(): any
}

/**
 * What a write function uses of an element, so it can also write to an
 * object that a component renders its first styles from.
 */
export type RenderTarget = HTMLElement | SVGElement

/**
 * A write function every key of a kind shares, e.g. each independent
 * transform writes `transform`. Made once per node.
 */
export const sharedRender = (
    node: RenderSource,
    name: string,
    create: () => NodeRender
) => {
    const shared = (node.shared ||= {})
    return (shared[name] ||= Object.assign(create(), { shared: true }))
}

/**
 * A latest value in its default unit, e.g. `originX: 50` -> `"50%"`.
 */
const styleValue = (node: RenderSource, key: string) =>
    getValueAsType(node.latestValues[key], numberValueTypes[key])

/**
 * The transforms record a transformTemplate is given. Without a
 * template nothing is written to it.
 */
const noTemplateTransforms = {}

/**
 * The function that writes `transform` from the node's independent
 * transforms (`x`, `scale` etc).
 */
export const getTransformRender = (
    element: HTMLElement | SVGElement,
    node: RenderSource
) =>
    sharedRender(node, "transform", () => () => {
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
        if (
            (element as SVGElement).ownerSVGElement !== undefined &&
            element.tagName !== "svg"
        ) {
            style.transformOrigin ||= "50% 50%"
            style.transformBox ||=
                latestValues.transformBox ||
                node.getProps().style?.transformBox ||
                "fill-box"
        }
    })

/**
 * The function that writes `key` to an element's style.
 */
export const getStyleRender = (
    element: HTMLElement | SVGElement,
    node: RenderSource,
    key: string
): NodeRender =>
    transformProps.has(key)
        ? getTransformRender(element, node)
        : key.startsWith("origin")
        ? sharedRender(node, "origin", () => () => {
              element.style.transformOrigin = `${
                  styleValue(node, "originX") ?? "50%"
              } ${styleValue(node, "originY") ?? "50%"} ${
                  styleValue(node, "originZ") ?? 0
              }`
          })
        : getValueRender(element, node, key)

/**
 * The function that writes a style or a CSS variable.
 */
const getValueRender = (
    element: HTMLElement | SVGElement,
    node: RenderSource,
    key: string
) => {
    /**
     * A style animating on the main thread repaints the element every
     * frame. If it also has compositor transforms, count it, as too many
     * such elements cost more than animating their transforms on the
     * main thread. A CSS variable is never composited.
     */
    const isComposited = acceleratedValues.has(key)

    return () => {
        if (!isComposited && transformGroups.has(element)) {
            const value = (node as MotionNode).values.get(key)
            value?.isAnimating() && markRepaint(element, value)
        }

        setStyle(element, key, styleValue(node, key) as string)
    }
}

export const addStyleValue = (
    element: HTMLElement | SVGElement,
    node: MotionNode,
    key: string,
    value?: MotionValue
) => node.set(key, value, getStyleRender(element, node, key))

export type StyleSubject = HTMLElement | SVGElement

export const isStyleSubject = (subject: unknown): subject is StyleSubject =>
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
 * also accept selectors. `animate()` attaches the `test` and `read` hooks
 * (see animation/animate/element.ts), so a `styleEffect()` import alone
 * doesn't bundle the computed-style readers.
 */
export const styleSubjectEffect = /*@__PURE__*/ createEffect(addStyleValue, {
    nodes: nodeStore,
})

export const styleEffect =
    /*@__PURE__*/ createSelectorEffect(styleSubjectEffect)
