"use client"

import {
    AnyResolvedKeyframe,
    buildVisualProps,
    getStyleRender,
    isForcedMotionValue,
    isMotionValue,
    MotionValue,
} from "motion-dom"
import { HTMLProps, useMemo } from "react"
import { MotionProps } from "../../motion/types"
import { ResolvedValues } from "../types"

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
    props: MotionProps,
    visualState: ResolvedValues
) {
    return useMemo(
        () => ({
            ...buildVisualProps(getStyleRender, visualState, props).style,
        }),
        [visualState]
    )
}

export function useHTMLProps(
    props: MotionProps & HTMLProps<HTMLElement>,
    visualState: ResolvedValues
) {
    const initialValues = useInitialMotionValues(props, visualState)

    /**
     * Built once per props, so a render with reused props returns the same
     * style object and React skips diffing it.
     */
    return useMemo(
        () => buildHTMLProps(props, initialValues),
        [props, initialValues]
    )
}

function buildHTMLProps(
    props: MotionProps & HTMLProps<HTMLElement>,
    initialValues: ResolvedValues
) {
    // The `any` isn't ideal but it is the type of createElement props argument
    const htmlProps: any = {}
    const style: ResolvedValues = {}

    /**
     * Copy non-Motion Values straight into style
     */
    copyRawValuesOnly(style, (props.style || {}) as any, props)
    Object.assign(style, initialValues)

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
