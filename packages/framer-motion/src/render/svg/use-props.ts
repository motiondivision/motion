import { MotionNodeState, ResolvedValues } from "motion-dom"
import { useMemo } from "react"
import { MotionProps } from "../../motion/types"
import { copyRawValuesOnly } from "../html/use-props"

export function useSVGProps(props: MotionProps, state: MotionNodeState) {
    const visualProps = useMemo(() => {
        // TODO: Remove cast and fix properly
        const { attrs, style } = state.build() as unknown as {
            attrs: ResolvedValues
            style: ResolvedValues
        }

        return {
            ...attrs,
            style: { ...style },
        }
    }, [state])

    if (props.style) {
        const rawStyles = {}
        copyRawValuesOnly(rawStyles, props.style as any, props)
        visualProps.style = { ...rawStyles, ...visualProps.style }
    }

    return visualProps
}
