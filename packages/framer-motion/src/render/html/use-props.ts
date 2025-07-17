import { AnyResolvedKeyframe, isMotionValue, MotionValue } from "motion-dom"
import { HTMLProps, useMemo } from "react"
import { MotionProps } from "../../motion/types"
import { isForcedMotionValue } from "../../motion/utils/is-forced-motion-value"
import { ResolvedValues } from "../types"
import { buildHTMLStyles } from "./utils/build-styles"
import { createHtmlRenderState } from "./utils/create-render-state"

export function copyRawValuesOnly(
    target: ResolvedValues,
    source: { [key: string]: AnyResolvedKeyframe | MotionValue },
    props: MotionProps
) {
    for (const key in source) {
        if (!isMotionValue(source[key]) && !isForcedMotionValue(key, props)) {
            target[key] = source[key] as AnyResolvedKeyframe
        }
    }
}

function useInitialMotionValues(
    { transformTemplate }: MotionProps,
    latestValues: ResolvedValues
) {
    return useMemo(() => {
        const state = createHtmlRenderState()

        buildHTMLStyles(state, latestValues, transformTemplate)

        return Object.assign({}, state.vars, state.style)
    }, [latestValues])
}

function useStyle(
    props: MotionProps,
    latestValues: ResolvedValues
): ResolvedValues {
    const styleProp = props.style || {}
    const style = {}

    /**
     * Copy non-Motion Values straight into style
     */
    copyRawValuesOnly(style, styleProp as any, props)

    Object.assign(style, useInitialMotionValues(props, latestValues))

    return style
}

export function useHTMLProps(
    props: MotionProps & HTMLProps<HTMLElement>,
    latestValues: ResolvedValues
) {
    // The `any` isn't ideal but it is the type of createElement props argument
    const htmlProps: any = {}
    const style = useStyle(props, latestValues)

    if (props.drag && props.dragListener !== false) {
        // Disable the ghost element when a user drags
        htmlProps.draggable = false

        // Disable text selection
        style.userSelect =
            style.WebkitUserSelect =
            style.WebkitTouchCallout =
                "none"

        // Disable scrolling on the draggable direction
        style.touchAction =
            props.drag === true
                ? "none"
                : `pan-${props.drag === "x" ? "y" : "x"}`
    }

    if (
        props.tabIndex === undefined &&
        (props.onTap || props.onTapStart || props.whileTap)
    ) {
        htmlProps.tabIndex = 0
    }

    htmlProps.style = style

    return htmlProps
}
