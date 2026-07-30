"use client"

import { buildSVGProps, isSVGTag } from "motion-dom"
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
        const { attrs, style } = buildSVGProps(
            visualState,
            isSVGTag(Component),
            props.transformTemplate,
            props.style
        )

        return {
            ...attrs,
            style: { ...style },
        }
    }, [visualState])

    if (props.style) {
        const rawStyles = {}
        copyRawValuesOnly(rawStyles, props.style as any, props)
        visualProps.style = { ...rawStyles, ...visualProps.style }
    }

    return visualProps
}
