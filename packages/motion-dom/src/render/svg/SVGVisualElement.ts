import type { AnyResolvedKeyframe } from "../../animation/types"
import type { MotionValue } from "../../value"
import type { MotionNodeOptions } from "../../node/types"
import { transformProps } from "../utils/keys-transform"
import { getDefaultValueType } from "../../value/types/maps/defaults"
import { createBox } from "../../projection/geometry/models"
import { DOMVisualElement } from "../dom/DOMVisualElement"
import type { DOMVisualElementOptions } from "../dom/types"
import { camelToDash } from "../dom/utils/camel-to-dash"
import type { ResolvedValues } from "../types"
import type { VisualElement, MotionStyle } from "../VisualElement"
import { SVGRenderState } from "./types"
import { buildSVGAttrs } from "./utils/build-attrs"
import { camelCaseAttributes } from "./utils/camel-case-attrs"
import { isSVGTag } from "./utils/is-svg-tag"
import { renderSVG } from "./utils/render"
import { scrapeMotionValuesFromProps } from "./utils/scrape-motion-values"
import type { TransformPoint, Point } from "motion-utils"

/**
 * Creates a transformPagePoint function that accounts for SVG viewBox scaling.
 *
 * When an SVG has a viewBox that differs from its rendered dimensions,
 * pointer coordinates need to be transformed to match the SVG's coordinate system.
 *
 * For example, if an SVG has viewBox="0 0 100 100" but is rendered at 500x500 pixels,
 * a mouse movement of 100 pixels should translate to 20 SVG units.
 */
function createSVGTransformPagePoint(
    svg: SVGSVGElement,
    existingTransform?: TransformPoint
): TransformPoint {
    return (point: Point): Point => {
        // Apply any existing transform first (e.g., from MotionConfig)
        if (existingTransform) {
            point = existingTransform(point)
        }

        // Get the viewBox attribute
        const viewBox = svg.viewBox?.baseVal
        if (!viewBox || (viewBox.width === 0 && viewBox.height === 0)) {
            // No viewBox or empty viewBox - no transformation needed
            return point
        }

        // Get the rendered dimensions of the SVG
        const bbox = svg.getBoundingClientRect()
        if (bbox.width === 0 || bbox.height === 0) {
            return point
        }

        // Calculate scale factors
        const scaleX = viewBox.width / bbox.width
        const scaleY = viewBox.height / bbox.height

        // Get the SVG's position on the page
        const svgX = bbox.left + window.scrollX
        const svgY = bbox.top + window.scrollY

        // Transform the point:
        // 1. Calculate position relative to SVG
        // 2. Scale by viewBox/viewport ratio
        // 3. Add back the SVG position (but in SVG coordinates)
        return {
            x: (point.x - svgX) * scaleX + svgX,
            y: (point.y - svgY) * scaleY + svgY,
        }
    }
}

export class SVGVisualElement extends DOMVisualElement<
    SVGElement,
    SVGRenderState,
    DOMVisualElementOptions
> {
    type = "svg"

    isSVGTag = false

    /**
     * Override getTransformPagePoint to automatically handle SVG viewBox scaling.
     *
     * When an SVG element is inside an SVG with a viewBox that differs from
     * the rendered dimensions, this ensures pointer coordinates are correctly
     * transformed to match the SVG's coordinate system.
     */
    getTransformPagePoint(): TransformPoint | undefined {
        // Get the existing transformPagePoint from props (e.g., from MotionConfig)
        const existingTransform = (this.props as any).transformPagePoint

        // If we don't have a mounted instance, fall back to the existing transform
        if (!this.current) {
            return existingTransform
        }

        // Get the owning SVG element
        const svg = this.current.ownerSVGElement
        if (!svg) {
            return existingTransform
        }

        // Create a transform function that accounts for viewBox scaling
        return createSVGTransformPagePoint(svg, existingTransform)
    }

    getBaseTargetFromProps(
        props: MotionNodeOptions,
        key: string
    ): AnyResolvedKeyframe | MotionValue<any> | undefined {
        return props[key as keyof MotionNodeOptions]
    }

    readValueFromInstance(instance: SVGElement, key: string) {
        if (transformProps.has(key)) {
            const defaultType = getDefaultValueType(key)
            return defaultType ? defaultType.default || 0 : 0
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

    build(
        renderState: SVGRenderState,
        latestValues: ResolvedValues,
        props: MotionNodeOptions
    ) {
        buildSVGAttrs(
            renderState,
            latestValues,
            this.isSVGTag,
            props.transformTemplate,
            (props as any).style
        )
    }

    renderInstance(
        instance: SVGElement,
        renderState: SVGRenderState,
        styleProp?: MotionStyle | undefined,
        projection?: any
    ): void {
        renderSVG(instance, renderState, styleProp, projection)
    }

    mount(instance: SVGElement) {
        this.isSVGTag = isSVGTag(instance.tagName)
        super.mount(instance)
    }
}
