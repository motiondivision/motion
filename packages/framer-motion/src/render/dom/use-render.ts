import { isMotionValue } from "motion-dom"
import { Fragment, createElement, useMemo } from "react"
import { RenderComponent } from "../../motion/features/types"
import { HTMLRenderState } from "../html/types"
import { useHTMLProps } from "../html/use-props"
import { SVGRenderState } from "../svg/types"
import { useSVGProps } from "../svg/use-props"
import { filterProps } from "./utils/filter-props"
import { isSVGComponent } from "./utils/is-svg-component"

export function createUseRender(forwardMotionProps = false) {
    const useRender: RenderComponent<
        HTMLElement | SVGElement,
        HTMLRenderState | SVGRenderState
    > = (Component, props, ref, { latestValues }, isStatic) => {
        const useVisualProps = isSVGComponent(Component)
            ? useSVGProps
            : useHTMLProps

        const visualProps = useVisualProps(
            props as any,
            latestValues,
            isStatic,
            Component
        )
        const filteredProps = filterProps(
            props,
            typeof Component === "string",
            forwardMotionProps
        )
        const elementProps =
            Component !== Fragment
                ? { ...filteredProps, ...visualProps, ref }
                : {}

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

    return useRender
}
