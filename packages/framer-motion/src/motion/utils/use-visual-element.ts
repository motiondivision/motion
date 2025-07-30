import * as React from "react"
import { useContext, useEffect, useInsertionEffect, useRef } from "react"
import { optimizedAppearDataAttribute } from "../../animation/optimized-appear/data-id"
import { LazyContext } from "../../context/LazyContext"
import { MotionConfigContext } from "../../context/MotionConfigContext"
import { MotionContext } from "../../context/MotionContext"
import { PresenceContext } from "../../context/PresenceContext"
import {
    InitialPromotionConfig,
    SwitchLayoutGroupContext,
} from "../../context/SwitchLayoutGroupContext"
import { MotionProps } from "../../motion/types"
import { IProjectionNode } from "../../projection/node/types"
import { DOMMotionComponents } from "../../render/dom/types"
import { HTMLRenderState } from "../../render/html/types"
import { SVGRenderState } from "../../render/svg/types"
import { CreateVisualElement } from "../../render/types"
import type { VisualElement } from "../../render/VisualElement"
import { isRefObject } from "../../utils/is-ref-object"
import { useIsomorphicLayoutEffect } from "../../utils/use-isomorphic-effect"
import { VisualState } from "./use-visual-state"

export function useVisualElement<
    Props,
    TagName extends keyof DOMMotionComponents | string
>(
    Component: TagName | string | React.ComponentType<Props>,
    visualState:
        | VisualState<SVGElement, SVGRenderState>
        | VisualState<HTMLElement, HTMLRenderState>,
    props: MotionProps & Partial<MotionConfigContext>,
    createVisualElement?: CreateVisualElement<Props, TagName>,
    ProjectionNodeConstructor?: any
): VisualElement<HTMLElement | SVGElement> | undefined {
    const { visualElement: parent } = useContext(MotionContext)
    const lazyContext = useContext(LazyContext)
    const presenceContext = useContext(PresenceContext)
    const reducedMotionConfig = useContext(MotionConfigContext).reducedMotion

    const visualElementRef = useRef<VisualElement<
        HTMLElement | SVGElement
    > | null>(null)

    /**
     * If we haven't preloaded a renderer, check to see if we have one lazy-loaded
     */
    createVisualElement =
        createVisualElement ||
        (lazyContext.renderer as CreateVisualElement<Props, TagName>)

    if (!visualElementRef.current && createVisualElement) {
        visualElementRef.current = createVisualElement(Component, {
            visualState,
            parent,
            props,
            presenceContext,
            blockInitialAnimation: presenceContext
                ? presenceContext.initial === false
                : false,
            reducedMotionConfig,
        })
    }

    const visualElement = visualElementRef.current

    /**
     * Load Motion gesture and animation features. These are rendered as renderless
     * components so each feature can optionally make use of React lifecycle methods.
     */
    const initialLayoutGroupConfig = useContext(SwitchLayoutGroupContext)

    if (
        visualElement &&
        !visualElement.projection &&
        ProjectionNodeConstructor &&
        (visualElement.type === "html" || visualElement.type === "svg")
    ) {
        createProjectionNode(
            visualElementRef.current!,
            props,
            ProjectionNodeConstructor,
            initialLayoutGroupConfig
        )
    }

    const isMounted = useRef(false)
    useInsertionEffect(() => {
        /**
         * Check the component has already mounted before calling
         * `update` unnecessarily. This ensures we skip the initial update.
         */
        if (visualElement && isMounted.current) {
            visualElement.update(props, presenceContext)
        }
    })

    /**
     * Cache this value as we want to know whether HandoffAppearAnimations
     * was present on initial render - it will be deleted after this.
     */
    const optimisedAppearId =
        props[optimizedAppearDataAttribute as keyof typeof props]
    const wantsHandoff = useRef(
        Boolean(optimisedAppearId) &&
            !window.MotionHandoffIsComplete?.(optimisedAppearId) &&
            window.MotionHasOptimisedAnimation?.(optimisedAppearId)
    )

    useIsomorphicLayoutEffect(() => {
        if (!visualElement) return

        isMounted.current = true
        window.MotionIsMounted = true

        visualElement.updateFeatures()
        visualElement.scheduleRenderMicrotask()

        /**
         * Ideally this function would always run in a useEffect.
         *
         * However, if we have optimised appear animations to handoff from,
         * it needs to happen synchronously to ensure there's no flash of
         * incorrect styles in the event of a hydration error.
         *
         * So if we detect a situtation where optimised appear animations
         * are running, we use useLayoutEffect to trigger animations.
         */
        if (wantsHandoff.current && visualElement.animationState) {
            visualElement.animationState.animateChanges()
        }
    })

    useEffect(() => {
        if (!visualElement) return

        if (!wantsHandoff.current && visualElement.animationState) {
            visualElement.animationState.animateChanges()
        }

        if (wantsHandoff.current) {
            // This ensures all future calls to animateChanges() in this component will run in useEffect
            queueMicrotask(() => {
                window.MotionHandoffMarkAsComplete?.(optimisedAppearId)
            })

            wantsHandoff.current = false
        }

        /**
         * Now we've finished triggering animations for this element we
         * can wipe the enteringChildren set for the next render.
         */
        visualElement.enteringChildren = undefined
    })

    return visualElement!
}

function createProjectionNode(
    visualElement: VisualElement<any>,
    props: MotionProps,
    ProjectionNodeConstructor: any,
    initialPromotionConfig?: InitialPromotionConfig
) {
    const {
        layoutId,
        layout,
        drag,
        dragConstraints,
        layoutScroll,
        layoutRoot,
        layoutCrossfade,
    } = props

    visualElement.projection = new ProjectionNodeConstructor(
        visualElement.latestValues,
        props["data-framer-portal-id"]
            ? undefined
            : getClosestProjectingNode(visualElement.parent)
    ) as IProjectionNode

    visualElement.projection.setOptions({
        layoutId,
        layout,
        alwaysMeasureLayout:
            Boolean(drag) || (dragConstraints && isRefObject(dragConstraints)),
        visualElement,
        /**
         * TODO: Update options in an effect. This could be tricky as it'll be too late
         * to update by the time layout animations run.
         * We also need to fix this safeToRemove by linking it up to the one returned by usePresence,
         * ensuring it gets called if there's no potential layout animations.
         *
         */
        animationType: typeof layout === "string" ? layout : "both",
        initialPromotionConfig,
        crossfade: layoutCrossfade,
        layoutScroll,
        layoutRoot,
    })
}

function getClosestProjectingNode(
    visualElement?: VisualElement<
        unknown,
        unknown,
        { allowProjection?: boolean }
    >
): IProjectionNode | undefined {
    if (!visualElement) return undefined

    return visualElement.options.allowProjection !== false
        ? visualElement.projection
        : getClosestProjectingNode(visualElement.parent)
}
