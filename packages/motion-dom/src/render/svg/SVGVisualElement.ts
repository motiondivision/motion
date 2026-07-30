import type { AnyResolvedKeyframe } from "../../animation/types"
import type { MotionValue } from "../../value"
import type { MotionNodeOptions } from "../../node/types"
import { MotionValueState } from "../../effects/MotionValueState"
import { addSVGValue } from "../../effects/svg"
import { renderSVGValues } from "../../effects/svg/render"
import { transformProps } from "../utils/keys-transform"
import { getDefaultValueType } from "../../value/types/maps/defaults"
import { createBox } from "../../projection/geometry/models"
import { DOMVisualElement } from "../dom/DOMVisualElement"
import type { DOMVisualElementOptions } from "../dom/types"
import { camelToDash } from "../dom/utils/camel-to-dash"
import type { VisualElement, MotionStyle } from "../VisualElement"
import { SVGRenderState } from "./types"
import { camelCaseAttributes } from "./utils/camel-case-attrs"
import { scrapeMotionValuesFromProps } from "./utils/scrape-motion-values"

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

    bindValueToState(
        instance: SVGElement,
        state: MotionValueState,
        key: string,
        value: MotionValue
    ): VoidFunction {
        return addSVGValue(instance, state, key, value)
    }

    renderValues(
        instance: SVGElement,
        state: MotionValueState,
        _styleProp?: MotionStyle,
        _projection?: any
    ) {
        renderSVGValues(instance, state)
    }
}
