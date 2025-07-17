import { AnyResolvedKeyframe, MotionNodeState } from "motion-dom"
import { useContext } from "react"
import { isAnimationControls } from "../../animation/utils/is-animation-controls"
import { MotionContext, MotionContextProps } from "../../context/MotionContext"
import {
    PresenceContext,
    type PresenceContextProps,
} from "../../context/PresenceContext"
import { ResolvedValues, ScrapeMotionValuesFromProps } from "../../render/types"
import {
    isControllingVariants as checkIsControllingVariants,
    isVariantNode as checkIsVariantNode,
} from "../../render/utils/is-controlling-variants"
import { resolveVariantFromProps } from "../../render/utils/resolve-variants"
import { useConstant } from "../../utils/use-constant"
import { resolveMotionValue } from "../../value/utils/resolve-motion-value"
import { MotionProps } from "../types"

export type UseMotionNodeState = (
    props: MotionProps,
    isStatic: boolean
) => MotionNodeState

export interface UseMotionNodeStateConfig {
    scrapeMotionValuesFromProps: ScrapeMotionValuesFromProps
    StateConstructor: new (initialValues: ResolvedValues) => MotionNodeState
}

function makeMotionNodeState(
    { scrapeMotionValuesFromProps, StateConstructor }: UseMotionNodeStateConfig,
    props: MotionProps,
    context: MotionContextProps,
    presenceContext: PresenceContextProps | null
) {
    return new StateConstructor(
        makeInitialValues(
            props,
            context,
            presenceContext,
            scrapeMotionValuesFromProps
        )
    )
}

function makeInitialValues(
    props: MotionProps,
    context: MotionContextProps,
    presenceContext: PresenceContextProps | null,
    scrapeMotionValues: ScrapeMotionValuesFromProps
) {
    const values: ResolvedValues = {}

    const motionValues = scrapeMotionValues(props, {})
    for (const key in motionValues) {
        values[key] = resolveMotionValue(motionValues[key])
    }

    let { initial, animate } = props
    const isControllingVariants = checkIsControllingVariants(props)
    const isVariantNode = checkIsVariantNode(props)

    if (
        context &&
        isVariantNode &&
        !isControllingVariants &&
        props.inherit !== false
    ) {
        if (initial === undefined) initial = context.initial
        if (animate === undefined) animate = context.animate
    }

    let isInitialAnimationBlocked = presenceContext
        ? presenceContext.initial === false
        : false
    isInitialAnimationBlocked = isInitialAnimationBlocked || initial === false

    const variantToSet = isInitialAnimationBlocked ? animate : initial

    if (
        variantToSet &&
        typeof variantToSet !== "boolean" &&
        !isAnimationControls(variantToSet)
    ) {
        const list = Array.isArray(variantToSet) ? variantToSet : [variantToSet]
        for (let i = 0; i < list.length; i++) {
            const resolved = resolveVariantFromProps(props, list[i] as any)
            if (resolved) {
                const { transitionEnd, transition, ...target } = resolved
                for (const key in target) {
                    let valueTarget = target[key as keyof typeof target]

                    if (Array.isArray(valueTarget)) {
                        /**
                         * Take final keyframe if the initial animation is blocked because
                         * we want to initialise at the end of that blocked animation.
                         */
                        const index = isInitialAnimationBlocked
                            ? valueTarget.length - 1
                            : 0
                        valueTarget = valueTarget[index] as any
                    }

                    if (valueTarget !== null) {
                        values[key] = valueTarget as AnyResolvedKeyframe
                    }
                }
                for (const key in transitionEnd) {
                    values[key] = transitionEnd[
                        key as keyof typeof transitionEnd
                    ] as AnyResolvedKeyframe
                }
            }
        }
    }

    return values
}

export const makeUseMotionNodeState =
    (config: UseMotionNodeStateConfig): UseMotionNodeState =>
    (props: MotionProps, isStatic: boolean): MotionNodeState => {
        const context = useContext(MotionContext)
        const presenceContext = useContext(PresenceContext)
        const make = () =>
            makeMotionNodeState(config, props, context, presenceContext)

        return isStatic ? make() : useConstant(make)
    }
