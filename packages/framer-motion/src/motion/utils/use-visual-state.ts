"use client"

import {
    AnyResolvedKeyframe,
    isAnimationControls,
    isControllingVariants as checkIsControllingVariants,
    isVariantNode as checkIsVariantNode,
    ResolvedValues,
    resolveVariantFromProps,
} from "motion-dom"
import { useContext } from "react"
import { MotionContext, MotionContextProps } from "../../context/MotionContext"
import {
    PresenceContext,
    type PresenceContextProps,
} from "../../context/PresenceContext"
import { ScrapeMotionValuesFromProps } from "../../render/types"
import { useConstant } from "../../utils/use-constant"
import { resolveMotionValue } from "motion-dom"
import { MotionProps } from "../types"
import { mountOpacity } from "./mount-opacity"

export interface VisualState<Instance, _RenderState = any> {
    latestValues: ResolvedValues
    onMount?: (instance: Instance) => void
}

export type UseVisualState<Instance, RenderState> = (
    props: MotionProps,
    isStatic: boolean
) => VisualState<Instance, RenderState>

export interface UseVisualStateConfig<RenderState> {
    scrapeMotionValuesFromProps: ScrapeMotionValuesFromProps
    /**
     * @deprecated Values are written by the node, which keeps no render state.
     */
    createRenderState?: () => RenderState
}

function makeState<I, RS>(
    { scrapeMotionValuesFromProps }: UseVisualStateConfig<RS>,
    props: MotionProps,
    context: MotionContextProps,
    presenceContext: PresenceContextProps | null
) {
    const state: VisualState<I, RS> = {
        latestValues: makeLatestValues(
            props,
            context,
            presenceContext,
            scrapeMotionValuesFromProps
        ),
    }

    return state
}

function makeLatestValues(
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
    let opacityFromVariant = false

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
                        if (key === "opacity") opacityFromVariant = true
                    }
                }
                for (const key in transitionEnd) {
                    values[key] = transitionEnd[
                        key as keyof typeof transitionEnd
                    ] as AnyResolvedKeyframe
                    if (key === "opacity") opacityFromVariant = true
                }
            }
        }
    }

    /**
     * Opacity 0 from `initial` (or `animate`, when the initial animation is
     * blocked) renders as 0.001, on the server and at the first mount. A
     * value the component was given in `style` keeps its own value. See
     * mount-opacity.ts for why.
     */
    if (opacityFromVariant && values.opacity === 0) {
        values.opacity = mountOpacity
    }

    return values
}

export const makeUseVisualState =
    <I, RS>(config: UseVisualStateConfig<RS>): UseVisualState<I, RS> =>
    (props: MotionProps, isStatic: boolean): VisualState<I, RS> => {
        const context = useContext(MotionContext)
        const presenceContext = useContext(PresenceContext)
        const make = () => makeState(config, props, context, presenceContext)

        return isStatic ? make() : useConstant(make)
    }
