"use client"

import { isMotionValue } from "motion-dom"
import { Fragment, createElement, useMemo } from "react"
import type { IsValidProp } from "../../context/MotionConfigContext"
import { MotionProps } from "../../motion/types"
import { VisualState } from "../../motion/utils/use-visual-state"
import { HTMLRenderState } from "../html/types"
import { useHTMLProps } from "../html/use-props"
import { SVGRenderState } from "../svg/types"
import { useSVGProps } from "../svg/use-props"
import { DOMMotionComponents } from "./types"
import { filterProps } from "./utils/filter-props"
import { isSVGComponent } from "./utils/is-svg-component"

export function useRender<
    Props = {},
    TagName extends keyof DOMMotionComponents | string = "div"
>(
    Component: TagName | string | React.ComponentType<Props>,
    props: MotionProps,
    ref: React.Ref<HTMLElement | SVGElement>,
    {
        latestValues,
    }: VisualState<HTMLElement | SVGElement, HTMLRenderState | SVGRenderState>,
    isStatic: boolean,
    forwardMotionProps: boolean = false,
    isSVG?: boolean,
    isValidProp?: IsValidProp
) {
    const useVisualProps =
        isSVG ?? isSVGComponent(Component) ? useSVGProps : useHTMLProps

    const visualProps = useVisualProps(
        props as any,
        latestValues,
        isStatic,
        Component as any
    )

    /**
     * If component has been handed a motion value as its child,
     * memoise its initial value and render that. Subsequent updates
     * will be handled by the onChange handler
     */
    const { children } = props
    const renderedChildren = useMemo(
        () => (isMotionValue(children) ? children.get() : children),
        [children]
    )

    /**
     * Props are reused when a render's props equal the last render's, so
     * the same element is returned and React skips diffing it.
     */
    return useMemo(
        () =>
            createElement<any>(
                Component,
                Component !== Fragment
                    ? {
                          ...filterProps(
                              props,
                              typeof Component === "string",
                              forwardMotionProps,
                              isValidProp
                          ),
                          ...visualProps,
                          ref,
                          children: renderedChildren,
                      }
                    : { children: renderedChildren }
            ),
        [props, visualProps, ref]
    )
}
