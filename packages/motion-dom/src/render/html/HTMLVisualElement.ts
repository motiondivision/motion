import { invariant, type Box } from "motion-utils"
import type { AnyResolvedKeyframe } from "../../animation/types"
import { readStyleValue, styleSubjectEffect } from "../../effects/style"
import type { MotionNodeOptions } from "../../node/types"
import { transformProps } from "../utils/keys-transform"
import { defaultTransformValue } from "../dom/parse-transform"
import { measureViewportBox } from "../../projection/utils/measure"
import { DOMVisualElement } from "../dom/DOMVisualElement"
import type { DOMVisualElementOptions } from "../dom/types"
import type { MotionConfigContextProps } from "../types"
import type { VisualElement } from "../VisualElement"
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

    effect = styleSubjectEffect

    mount(instance: HTMLElement) {
        /**
         * If a custom component forwards its ref to something other than a
         * HTML/SVG element (a class instance, an imperative handle) there's
         * nothing for Motion to style, measure or attach gestures to. #2777
         */
        invariant(
            Boolean(instance.style),
            "motion.create() components must forward their ref to a HTML or SVG element",
            "custom-component-ref"
        )

        super.mount(instance)
    }

    readValueFromInstance(
        instance: HTMLElement,
        key: string
    ): AnyResolvedKeyframe | null | undefined {
        return transformProps.has(key) && this.projection?.isProjecting
            ? defaultTransformValue(key)
            : readStyleValue(instance, key)
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
}
