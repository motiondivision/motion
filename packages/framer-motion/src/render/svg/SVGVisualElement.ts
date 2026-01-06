import {
    AnyResolvedKeyframe,
    frame,
    getDefaultValueType,
    MotionValue,
    SVGMotionValueState,
    transformProps,
} from "motion-dom"
import { MotionProps, MotionStyle } from "../../motion/types"
import { createBox } from "../../projection/geometry/models"
import { IProjectionNode } from "../../projection/node/types"
import { DOMVisualElement } from "../dom/DOMVisualElement"
import { DOMVisualElementOptions } from "../dom/types"
import { camelToDash } from "../dom/utils/camel-to-dash"
import { ResolvedValues } from "../types"
import { VisualElement } from "../VisualElement"
import { SVGRenderState } from "./types"
import { buildSVGAttrs } from "./utils/build-attrs"
import { camelCaseAttributes } from "./utils/camel-case-attrs"
import { isSVGTag } from "./utils/is-svg-tag"
import { renderSVG } from "./utils/render"
import { scrapeMotionValuesFromProps } from "./utils/scrape-motion-values"

export class SVGVisualElement extends DOMVisualElement<
    SVGElement,
    SVGRenderState,
    DOMVisualElementOptions
> {
    type = "svg"

    isSVGTag = false

    createMotionValueState(): SVGMotionValueState {
        return new SVGMotionValueState({
            element: this.current,
            isSVGTag: this.isSVGTag,
            getTransformTemplate: () => this.props.transformTemplate,
            onTransformChange: () => {
                if (this.projection) {
                    this.projection.isTransformDirty = true
                }
            },
            onUpdate: () => {
                if (this.props.onUpdate) {
                    // Use postRender so onUpdate fires in the current frame
                    // (render callbacks run in render phase, preRender would go to next frame)
                    frame.postRender(this.notifyUpdate)
                }
            },
            onValueChange: (key, value) => {
                // Skip internal computed values
                if (
                    key === "transform" ||
                    key === "transformOrigin" ||
                    key === "stroke-dasharray"
                ) {
                    return
                }

                // Sync to latestValues
                this.latestValues[key] = value

                // Mark projection dirty for transforms
                if (transformProps.has(key) && this.projection) {
                    this.projection.isTransformDirty = true
                }

                // Schedule full render for backward compatibility
                this.scheduleRender()
            },
            // Provide access to full latestValues for transform building
            getLatestValues: () => this.latestValues,
        })
    }

    getBaseTargetFromProps(
        props: MotionProps,
        key: string
    ): AnyResolvedKeyframe | MotionValue<any> | undefined {
        return props[key as keyof MotionProps]
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
        props: MotionProps,
        prevProps: MotionProps,
        visualElement: VisualElement
    ) {
        return scrapeMotionValuesFromProps(props, prevProps, visualElement)
    }

    build(
        renderState: SVGRenderState,
        latestValues: ResolvedValues,
        props: MotionProps
    ) {
        buildSVGAttrs(
            renderState,
            latestValues,
            this.isSVGTag,
            props.transformTemplate,
            props.style
        )
    }

    renderInstance(
        instance: SVGElement,
        renderState: SVGRenderState,
        styleProp?: MotionStyle | undefined,
        projection?: IProjectionNode<unknown> | undefined
    ): void {
        renderSVG(instance, renderState, styleProp, projection)
    }

    mount(instance: SVGElement) {
        this.isSVGTag = isSVGTag(instance.tagName)
        super.mount(instance)
    }
}
