import type { Box } from "motion-utils"
import type { AnyResolvedKeyframe } from "../../animation/types"
import { isCSSVariableName } from "../../animation/utils/is-css-variable"
import type { MotionNodeOptions } from "../../node/types"
import { transformProps } from "../utils/keys-transform"
import {
    defaultTransformValue,
    readTransformValue,
} from "../dom/parse-transform"
import { measureViewportBox } from "../../projection/utils/measure"
import { DOMVisualElement } from "../dom/DOMVisualElement"
import type { DOMVisualElementOptions } from "../dom/types"
import type { ResolvedValues, MotionConfigContextProps } from "../types"
import type { VisualElement } from "../VisualElement"
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
        { transformPagePoint }: MotionNodeOptions & Partial<MotionConfigContextProps>
    ): Box {
        return measureViewportBox(instance, transformPagePoint)
    }

    build(
        renderState: HTMLRenderState,
        latestValues: ResolvedValues,
        props: MotionNodeOptions
    ) {
        buildHTMLStyles(renderState, latestValues, props.transformTemplate)
    }

    scrapeMotionValuesFromProps(
        props: MotionNodeOptions,
        prevProps: MotionNodeOptions,
        visualElement: VisualElement
    ) {
        return scrapeMotionValuesFromProps(props, prevProps, visualElement)
    }

    renderInstance = renderHTML
}
