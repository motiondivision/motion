import { MotionConfigContext } from "../../context/MotionConfigContext"
import { MotionProps } from "../../motion/types"
import type { Box } from "../../projection/geometry/types"
import { measureViewportBox } from "../../projection/utils/measure"
import { DOMVisualElement } from "../dom/DOMVisualElement"
import { DOMVisualElementOptions } from "../dom/types"
import { isCSSVariableName } from "../dom/utils/is-css-variable"
import type { ResolvedValues } from "../types"
import { VisualElement } from "../VisualElement"
import { HTMLRenderState } from "./types"
import { buildHTMLStyles } from "./utils/build-styles"
import { transformProps } from "./utils/keys-transform"
import { readTransformValue } from "./utils/parse-transform"
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
    ): string | number | null | undefined {
        if (transformProps.has(key)) {
            return readTransformValue(instance, key)
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
