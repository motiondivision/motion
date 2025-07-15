import { AnyResolvedKeyframe, MotionValueState } from "motion-dom"
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

export interface VisualState<RenderState> {
    renderState: RenderState
    // TODO: This should replace the VisualState itself
    // but as an initial step we're using it just to store the
    // flat initial values
    state: MotionValueState
}

export type UseVisualState<RenderState> = (
    props: MotionProps,
    isStatic: boolean
) => VisualState<RenderState>

export interface UseVisualStateConfig<RenderState> {
    scrapeMotionValuesFromProps: ScrapeMotionValuesFromProps
    createRenderState: () => RenderState
}

function makeState<RS>(
    {
        scrapeMotionValuesFromProps,
        createRenderState,
    }: UseVisualStateConfig<RS>,
    props: MotionProps,
    context: MotionContextProps,
    presenceContext: PresenceContextProps | null
) {
    const initialValues = makeInitialValues(
        props,
        context,
        presenceContext,
        scrapeMotionValuesFromProps
    )

    const state: VisualState<RS> = {
        state: new MotionValueState(initialValues),
        renderState: createRenderState(),
    }

    return state
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

export const makeUseVisualState =
    <RS>(config: UseVisualStateConfig<RS>): UseVisualState<RS> =>
    (props: MotionProps, isStatic: boolean): VisualState<RS> => {
        const context = useContext(MotionContext)
        const presenceContext = useContext(PresenceContext)
        const make = () => makeState(config, props, context, presenceContext)

        return isStatic ? make() : useConstant(make)
    }
