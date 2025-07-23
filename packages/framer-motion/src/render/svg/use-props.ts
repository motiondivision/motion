"use client"

import { useMemo } from "react"
import { MotionProps } from "../../motion/types"
import { copyRawValuesOnly } from "../html/use-props"
import { ResolvedValues } from "../types"
import { buildSVGAttrs } from "./utils/build-attrs"
import { createSvgRenderState } from "./utils/create-render-state"
import { isSVGTag } from "./utils/is-svg-tag"

export function useSVGProps(
    props: MotionProps,
    visualState: ResolvedValues,
    _isStatic: boolean,
    Component: string | React.ComponentType<React.PropsWithChildren<unknown>>
) {
    const visualProps = useMemo(() => {
        const state = createSvgRenderState()

        buildSVGAttrs(
            state,
            visualState,
            isSVGTag(Component),
            props.transformTemplate,
            props.style
        )

        return {
            ...state.attrs,
            style: { ...state.style },
        }
    }, [visualState])

    if (props.style) {
        const rawStyles = {}
        copyRawValuesOnly(rawStyles, props.style as any, props)
        visualProps.style = { ...rawStyles, ...visualProps.style }
    }

    return visualProps
}
