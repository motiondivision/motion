"use client"

import { invariant, warning } from "motion-utils"
import * as React from "react"
import { forwardRef, useContext } from "react"
import { LayoutGroupContext } from "../context/LayoutGroupContext"
import { LazyContext } from "../context/LazyContext"
import { MotionConfigContext } from "../context/MotionConfigContext"
import { MotionContext } from "../context/MotionContext"
import { useCreateMotionContext } from "../context/MotionContext/create"
import { CreateVisualElement } from "../render/types"
import { isBrowser } from "../utils/is-browser"
import { featureDefinitions } from "./features/definitions"
import { loadFeatures } from "./features/load-features"
import { FeatureBundle, RenderComponent } from "./features/types"
import { MotionProps } from "./types"
import { motionComponentSymbol } from "./utils/symbol"
import { useMotionRef } from "./utils/use-motion-ref"
import { useVisualElement } from "./utils/use-visual-element"
import { UseVisualState } from "./utils/use-visual-state"

export interface MotionComponentConfig<Instance, RenderState> {
    preloadedFeatures?: FeatureBundle
    createVisualElement?: CreateVisualElement<Instance>
    useRender: RenderComponent<Instance, RenderState>
    useVisualState: UseVisualState<Instance, RenderState>
    Component: string | React.ComponentType<React.PropsWithChildren<unknown>>
}

export type MotionComponentProps<Props> = {
    [K in Exclude<keyof Props, keyof MotionProps>]?: Props[K]
} & MotionProps

/**
 * Create a `motion` component.
 *
 * This function accepts a Component argument, which can be either a string (ie "div"
 * for `motion.div`), or an actual React component.
 *
 * Alongside this is a config option which provides a way of rendering the provided
 * component "offline", or outside the React render cycle.
 */
export function createRendererMotionComponent<
    Props extends {},
    Instance,
    RenderState
>({
    preloadedFeatures,
    createVisualElement,
    useRender,
    useVisualState,
    Component,
}: MotionComponentConfig<Instance, RenderState>) {
    preloadedFeatures && loadFeatures(preloadedFeatures)

    function MotionComponent(
        props: MotionComponentProps<Props>,
        externalRef?: React.Ref<Instance>
    ) {
        /**
         * If we need to measure the element we load this functionality in a
         * separate class component in order to gain access to getSnapshotBeforeUpdate.
         */
        let MeasureLayout: undefined | React.ComponentType<MotionProps>

        const configAndProps = {
            ...useContext(MotionConfigContext),
            ...props,
            layoutId: useLayoutId(props),
        }

        const { isStatic } = configAndProps

        const context = useCreateMotionContext<Instance>(props)

        const visualState = useVisualState(props, isStatic)

        if (!isStatic && isBrowser) {
            useStrictMode(configAndProps, preloadedFeatures)

            const layoutProjection = getProjectionFunctionality(configAndProps)
            MeasureLayout = layoutProjection.MeasureLayout

            /**
             * Create a VisualElement for this component. A VisualElement provides a common
             * interface to renderer-specific APIs (ie DOM/Three.js etc) as well as
             * providing a way of rendering to these APIs outside of the React render loop
             * for more performant animations and interactions
             */
            context.visualElement = useVisualElement<Instance, RenderState>(
                Component,
                visualState,
                configAndProps,
                createVisualElement,
                layoutProjection.ProjectionNode
            )
        }

        /**
         * The mount order and hierarchy is specific to ensure our element ref
         * is hydrated by the time features fire their effects.
         */
        return (
            <MotionContext.Provider value={context}>
                {MeasureLayout && context.visualElement ? (
                    <MeasureLayout
                        visualElement={context.visualElement}
                        {...configAndProps}
                    />
                ) : null}
                {useRender(
                    Component,
                    props,
                    useMotionRef<Instance, RenderState>(
                        visualState,
                        context.visualElement,
                        externalRef
                    ),
                    visualState,
                    isStatic,
                    context.visualElement
                )}
            </MotionContext.Provider>
        )
    }

    MotionComponent.displayName = `motion.${
        typeof Component === "string"
            ? Component
            : `create(${Component.displayName ?? Component.name ?? ""})`
    }`

    const ForwardRefMotionComponent = forwardRef(MotionComponent as any)
    ;(ForwardRefMotionComponent as any)[motionComponentSymbol] = Component

    return ForwardRefMotionComponent
}

function useLayoutId({ layoutId }: MotionProps) {
    const layoutGroupId = useContext(LayoutGroupContext).id
    return layoutGroupId && layoutId !== undefined
        ? layoutGroupId + "-" + layoutId
        : layoutId
}

function useStrictMode(
    configAndProps: MotionProps,
    preloadedFeatures?: FeatureBundle
) {
    const isStrict = useContext(LazyContext).strict

    /**
     * If we're in development mode, check to make sure we're not rendering a motion component
     * as a child of LazyMotion, as this will break the file-size benefits of using it.
     */
    if (
        process.env.NODE_ENV !== "production" &&
        preloadedFeatures &&
        isStrict
    ) {
        const strictMessage =
            "You have rendered a `motion` component within a `LazyMotion` component. This will break tree shaking. Import and render a `m` component instead."
        configAndProps.ignoreStrict
            ? warning(false, strictMessage)
            : invariant(false, strictMessage)
    }
}

function getProjectionFunctionality(props: MotionProps) {
    const { drag, layout } = featureDefinitions

    if (!drag && !layout) return {}

    const combined = { ...drag, ...layout }

    return {
        MeasureLayout:
            drag?.isEnabled(props) || layout?.isEnabled(props)
                ? combined.MeasureLayout
                : undefined,
        ProjectionNode: combined.ProjectionNode,
    }
}
