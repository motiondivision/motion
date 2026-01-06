import {
    AnyResolvedKeyframe,
    defaultTransformValue,
    frame,
    HTMLMotionValueState,
    isCSSVariableName,
    readTransformValue,
    transformProps,
} from "motion-dom"
import type { Box } from "motion-utils"
import { MotionConfigContext } from "../../context/MotionConfigContext"
import { MotionProps } from "../../motion/types"
import { measureViewportBox } from "../../projection/utils/measure"
import { DOMVisualElement } from "../dom/DOMVisualElement"
import { DOMVisualElementOptions } from "../dom/types"
import type { ResolvedValues } from "../types"
import { VisualElement } from "../VisualElement"
import { HTMLRenderState } from "./types"
import { buildHTMLStyles } from "./utils/build-styles"
import { renderHTML } from "./utils/render"
import { scrapeMotionValuesFromProps } from "./utils/scrape-motion-values"

export function getComputedStyle(element: HTMLElement) {
    return window.getComputedStyle(element)
}

export class HTMLVisualElement extends DOMVisualElement<
    HTMLElement,
    HTMLRenderState,
    DOMVisualElementOptions
> {
    type = "html"

    createMotionValueState(): HTMLMotionValueState {
        return new HTMLMotionValueState({
            element: this.current,
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
                // Skip internal computed values (transform, transformOrigin)
                // These are internal to the state and shouldn't sync to latestValues
                if (key === "transform" || key === "transformOrigin") {
                    return
                }

                // Skip if value hasn't actually changed - prevents duplicate onUpdate calls
                if (this.latestValues[key] === value) {
                    return
                }

                // Sync to latestValues
                this.latestValues[key] = value

                // Mark projection dirty for transforms
                if (transformProps.has(key) && this.projection) {
                    this.projection.isTransformDirty = true
                }

                // Note: onUpdate is handled by state's render callbacks for most values,
                // but we still schedule render for backward compatibility
                this.scheduleRender()
            },
            // Provide access to full latestValues for transform building
            // This includes values from initial/animate that may not be in state
            getLatestValues: () => this.latestValues,
        })
    }

    readValueFromInstance(
        instance: HTMLElement,
        key: string
    ): AnyResolvedKeyframe | null | undefined {
        if (transformProps.has(key)) {
            return this.projection?.isProjecting
                ? defaultTransformValue(key)
                : readTransformValue(instance, key)
        } else {
            const computedStyle = getComputedStyle(instance)
            const value =
                (isCSSVariableName(key)
                    ? computedStyle.getPropertyValue(key)
                    : computedStyle[key as keyof typeof computedStyle]) || 0

            return typeof value === "string" ? value.trim() : (value as number)
        }
    }

    measureInstanceViewportBox(
        instance: HTMLElement,
        { transformPagePoint }: MotionProps & Partial<MotionConfigContext>
    ): Box {
        return measureViewportBox(instance, transformPagePoint)
    }

    build(
        renderState: HTMLRenderState,
        latestValues: ResolvedValues,
        props: MotionProps
    ) {
        buildHTMLStyles(renderState, latestValues, props.transformTemplate)
    }

    scrapeMotionValuesFromProps(
        props: MotionProps,
        prevProps: MotionProps,
        visualElement: VisualElement
    ) {
        return scrapeMotionValuesFromProps(props, prevProps, visualElement)
    }

    renderInstance = renderHTML
}
