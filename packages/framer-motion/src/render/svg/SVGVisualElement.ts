import { getDefaultValueType, MotionValue, transformProps } from "motion-dom"
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

    getBaseTargetFromProps(
        props: MotionProps,
        key: string
    ): string | number | MotionValue<any> | undefined {
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
