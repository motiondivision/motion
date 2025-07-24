"use client"

import { useContext, useMemo } from "react"
import { MotionContext, type MotionContextProps } from "."
import { MotionProps } from "../../motion/types"
import { getCurrentTreeVariants } from "./utils"

export function useCreateMotionContext<Instance>(
    props: MotionProps
): MotionContextProps<Instance> {
    const { initial, animate } = getCurrentTreeVariants(
        props,
        useContext(MotionContext)
    )

    return useMemo(
        () => ({ initial, animate }),
        [variantLabelsAsDependency(initial), variantLabelsAsDependency(animate)]
    )
}

function variantLabelsAsDependency(
    prop: undefined | string | string[] | boolean
) {
    return Array.isArray(prop) ? prop.join(" ") : prop
}
