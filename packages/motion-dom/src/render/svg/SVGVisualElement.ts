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
import { getSVGRender } from "./utils/get-render"
import { SVGRenderState } from "./types"
import { cssStyleProperties } from "./utils/build-attrs"
import { camelCaseAttributes } from "./utils/camel-case-attrs"
import { scrapeMotionValuesFromProps } from "./utils/scrape-motion-values"

const attrName = (name: string) =>
    camelCaseAttributes.has(name) ? name : camelToDash(name)

const addSVGComponentValue = (
    element: SVGElement,
    node: MotionNode,
    key: string,
    value?: MotionValue
) => node.set(key, value, getSVGRender(element, node, key, attrName))

export class SVGVisualElement extends DOMVisualElement<
    SVGElement,
    SVGRenderState,
    DOMVisualElementOptions
> {
    type = "svg"

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

        return instance.getAttribute(attrName(key))
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
}
