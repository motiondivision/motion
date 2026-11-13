import type { AnyResolvedKeyframe } from "../../animation/types"
import type { MotionValue } from "../../value"
import type { MotionNodeOptions } from "../../node/types"
import { transformProps } from "../utils/keys-transform"
import { getDefaultValueType } from "../../value/types/maps/defaults"
import { createBox } from "../../projection/geometry/models"
import { DOMVisualElement } from "../dom/DOMVisualElement"
import { defaultTransformValue } from "../dom/parse-transform"
import type { DOMVisualElementOptions } from "../dom/types"
import { camelToDash } from "../dom/utils/camel-to-dash"
import type { VisualElement } from "../VisualElement"
import type { MotionNode } from "../../node/MotionNode"
import { addStyleValue } from "../../effects/style"
import { isSVGStyle } from "../../effects/svg"
import { numberValueTypes } from "../../value/types/maps/number"
import { getValueAsType } from "../../value/types/utils/get-as-type"
import { SVGRenderState } from "./types"
import { cssStyleProperties } from "./utils/build-attrs"
import { camelCaseAttributes } from "./utils/camel-case-attrs"
import { isSVGTag } from "./utils/is-svg-tag"
import { scrapeMotionValuesFromProps } from "./utils/scrape-motion-values"

const attrKeys: { [key: string]: string } = {
    attrX: "x",
    attrY: "y",
    attrScale: "scale",
}

/**
 * Binds a key of a motion SVG component. Everything is an attribute,
 * except on the <svg> tag itself and for the values that only work, or
 * that WAAPI writes, as styles.
 */
const addSVGComponentValue = (
    element: SVGElement,
    node: MotionNode,
    key: string,
    value?: MotionValue
) => {
    const { latestValues } = node
    const isRoot = isSVGTag(element.tagName)

    if (
        isRoot
            ? key !== "viewBox"
            : isSVGStyle(key) ||
              cssStyleProperties.includes(key) ||
              key === "transformOrigin" ||
              key === "transformBox"
    ) {
        return addStyleValue(element, node, key, value)
    }

    /**
     * pathLength, pathSpacing and pathOffset are written together, as a
     * dash pattern on a path normalised to a length of 1. Unitless, as
     * Safari scales px values when the page is zoomed.
     */
    if (key.startsWith("path")) {
        return node.set(
            key,
            value,
            ((node.shared ||= {}).dash ||= () => {
                const { pathLength, pathSpacing = 1, pathOffset = 0 } =
                    latestValues
                if (pathLength === undefined) return
                element.setAttribute("pathLength", "1")
                element.setAttribute("stroke-dashoffset", `${-pathOffset}`)
                element.setAttribute(
                    "stroke-dasharray",
                    `${pathLength} ${pathSpacing}`
                )
            }),
            true
        )
    }

    const name =
        attrKeys[key] ||
        (camelCaseAttributes.has(key) ? key : camelToDash(key))

    return node.set(key, value, () => {
        element.setAttribute(
            name,
            getValueAsType(latestValues[key], numberValueTypes[key]) as string
        )
    })
}

export class SVGVisualElement extends DOMVisualElement<
    SVGElement,
    SVGRenderState,
    DOMVisualElementOptions
> {
    type = "svg"

    isSVGTag = false

    getBaseTargetFromProps(
        props: MotionNodeOptions,
        key: string
    ): AnyResolvedKeyframe | MotionValue<any> | undefined {
        /**
         * An independent transform's base is never an attribute of the same
         * name, e.g. <rect x> is a position, not a translate. Like HTML it
         * comes from style, falling back to the transform's default.
         */
        return transformProps.has(key)
            ? super.getBaseTargetFromProps(props, key) ??
                  defaultTransformValue(key)
            : props[key as keyof MotionNodeOptions]
    }

    /**
     * An independent transform's origin is never read from the DOM, so it
     * starts from its latest or default value and renders on mount.
     */
    getDefaultValue(key: string) {
        return transformProps.has(key)
            ? this.latestValues[key] ?? defaultTransformValue(key)
            : undefined
    }

    readValueFromInstance(instance: SVGElement, key: string) {
        if (transformProps.has(key)) {
            const defaultType = getDefaultValueType(key)
            return defaultType ? defaultType.default || 0 : 0
        }

        if (cssStyleProperties.includes(key)) {
            const computedStyle = getComputedStyle(instance)
            const value = computedStyle[key as keyof typeof computedStyle]
            if (typeof value === "string" && value) return value.trim()
        }

        key = !camelCaseAttributes.has(key) ? camelToDash(key) : key
        return instance.getAttribute(key)
    }

    measureInstanceViewportBox = createBox

    scrapeMotionValuesFromProps(
        props: MotionNodeOptions,
        prevProps: MotionNodeOptions,
        visualElement: VisualElement
    ) {
        return scrapeMotionValuesFromProps(props, prevProps, visualElement)
    }

    bind = addSVGComponentValue

    mount(instance: SVGElement) {
        this.isSVGTag = isSVGTag(instance.tagName)
        super.mount(instance)
    }
}
