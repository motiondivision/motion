import type { AnyResolvedKeyframe } from "../../animation/types"
import { readSVGValue, svgSubjectEffect } from "../../effects/svg"
import type { MotionValue } from "../../value"
import type { MotionNodeOptions } from "../../node/types"
import { transformProps } from "../utils/keys-transform"
import { createBox } from "../../projection/geometry/models"
import { DOMVisualElement } from "../dom/DOMVisualElement"
import { defaultTransformValue } from "../dom/parse-transform"
import type { DOMVisualElementOptions } from "../dom/types"
import type { VisualElement } from "../VisualElement"
import { SVGRenderState } from "./types"
import { scrapeMotionValuesFromProps } from "./utils/scrape-motion-values"

export class SVGVisualElement extends DOMVisualElement<
    SVGElement,
    SVGRenderState,
    DOMVisualElementOptions
> {
    type = "svg"

    effect = svgSubjectEffect

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
        return readSVGValue(instance, key)
    }

    measureInstanceViewportBox = createBox

    scrapeMotionValuesFromProps(
        props: MotionNodeOptions,
        prevProps: MotionNodeOptions,
        visualElement: VisualElement
    ) {
        return scrapeMotionValuesFromProps(props, prevProps, visualElement)
    }
}
