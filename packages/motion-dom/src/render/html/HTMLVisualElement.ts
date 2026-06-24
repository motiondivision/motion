import type { Box } from "motion-utils"
import type { AnyResolvedKeyframe } from "../../animation/types"
import { isCSSVariableName } from "../../animation/utils/is-css-variable"
import { MotionValueState } from "../../effects/MotionValueState"
import { addStyleValue } from "../../effects/style"
import { renderStyles } from "../../effects/style/render"
import type { MotionNodeOptions } from "../../node/types"
import type { MotionValue } from "../../value"
import { transformProps } from "../utils/keys-transform"
import {
    defaultTransformValue,
    readTransformValue,
} from "../dom/parse-transform"
import { measureViewportBox } from "../../projection/utils/measure"
import { DOMVisualElement } from "../dom/DOMVisualElement"
import type { DOMVisualElementOptions } from "../dom/types"
import type { MotionConfigContextProps } from "../types"
import type { VisualElement, MotionStyle } from "../VisualElement"
import { HTMLRenderState } from "./types"
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

    scrapeMotionValuesFromProps(
        props: MotionNodeOptions,
        prevProps: MotionNodeOptions,
        visualElement: VisualElement
    ) {
        return scrapeMotionValuesFromProps(props, prevProps, visualElement)
    }

    bindValueToState(
        instance: HTMLElement,
        state: MotionValueState,
        key: string,
        value: MotionValue
    ): VoidFunction {
        return addStyleValue(instance, state, key, value)
    }

    renderValues(
        instance: HTMLElement,
        state: MotionValueState,
        styleProp?: MotionStyle,
        projection?: any
    ) {
        renderStyles(instance, state)
        projection?.applyProjectionStyles(instance.style, styleProp)
    }
}
