import { isMotionValue, MotionNodeState } from "motion-dom"
import { createElement, Fragment, useMemo } from "react"
import { MotionProps } from "../../motion/types"
import { useHTMLProps } from "../html/use-props"
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
    state: MotionNodeState,
    forwardMotionProps: boolean = false
) {
    const useVisualProps = isSVGComponent(Component)
        ? useSVGProps
        : useHTMLProps

    const visualProps = useVisualProps(props as any, state)
    const filteredProps = filterProps(
        props,
        typeof Component === "string",
        forwardMotionProps
    )
    const elementProps =
        Component !== Fragment ? { ...filteredProps, ...visualProps, ref } : {}

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

    return createElement<any>(Component, {
        ...elementProps,
        children: renderedChildren,
    })
}
