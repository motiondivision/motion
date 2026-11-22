"use client"

import { buildVisualProps, getSVGRender } from "motion-dom"
import { useMemo } from "react"
import { MotionProps } from "../../motion/types"
import { copyRawValuesOnly } from "../html/use-props"
import { ResolvedValues } from "../types"

export function useSVGProps(
    props: MotionProps,
    visualState: ResolvedValues,
    _isStatic: boolean,
    Component: string | React.ComponentType<React.PropsWithChildren<unknown>>
) {
    const visualProps = useMemo(() => {
        const { attrs, style } = buildVisualProps(
            getSVGRender,
            visualState,
            props,
            Component
        )

        return { ...attrs, style: { ...style } }
    }, [visualState])

    /**
     * Build a fresh style per props rather than writing back into the
     * memoised visualProps, which would carry the previous props' raw
     * styles over (and above) the latest ones.
     */
    return useMemo(() => {
        if (!props.style) return visualProps
        const style = {}
        copyRawValuesOnly(style, props.style as any, props)
        return { ...visualProps, style: { ...style, ...visualProps.style } }
    }, [props, visualProps])
}
