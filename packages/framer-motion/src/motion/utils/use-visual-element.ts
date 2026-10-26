"use client"

import {
    optimizedAppearDataAttribute,
    type HTMLRenderState,
    type SVGRenderState,
    type VisualElement,
} from "motion-dom"
import * as React from "react"
import { useContext, useEffect, useInsertionEffect, useRef } from "react"
import { LazyContext } from "../../context/LazyContext"
import { MotionConfigContext } from "../../context/MotionConfigContext"
import { MotionContext } from "../../context/MotionContext"
import { PresenceContext } from "../../context/PresenceContext"
import { SwitchLayoutGroupContext } from "../../context/SwitchLayoutGroupContext"
import { MotionProps } from "../../motion/types"
import { DOMMotionComponents } from "../../render/dom/types"
import { CreateVisualElement } from "../../render/types"
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
    ProjectionNodeConstructor?: any,
    isSVG?: boolean
): VisualElement<HTMLElement | SVGElement> | undefined {
    const { visualElement: parent } = useContext(MotionContext)
    const lazyContext = useContext(LazyContext)
    const presenceContext = useContext(PresenceContext)
    const motionConfig = useContext(MotionConfigContext)
    const reducedMotionConfig = motionConfig.reducedMotion
    const skipAnimations = motionConfig.skipAnimations

    const visualElementRef = useRef<VisualElement<
        HTMLElement | SVGElement
    > | null>(null)

    /**
     * Track whether the component has been through React's commit phase.
     * Used to detect when LazyMotion features load after the component has mounted.
     */
    const hasMountedOnce = useRef(false)

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
            skipAnimations,
            isSVG,
        })

        /**
         * If the component has already mounted before features loaded (e.g. via
         * LazyMotion with async feature loading), we need to force the initial
         * animation to run. Otherwise state changes that occurred before features
         * loaded will be lost and the element will snap to its final state.
         */
        if (hasMountedOnce.current && visualElementRef.current) {
            visualElementRef.current.manuallyAnimateOnMount = true
        }
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
        /**
         * Classes built by createProjectionNode set up their node from the
         * component's props, so the setup is only bundled with the layout
         * and drag features.
         */
        ProjectionNodeConstructor.create(
            visualElement,
            props,
            initialLayoutGroupConfig
        )
    }

    useInsertionEffect(() => {
        /**
         * Skip the update if the visual element was created with these props.
         * This isn't gated on the layout effect below having run, as a hidden
         * <Activity> runs insertion effects but not layout effects, and
         * props from renders made while hidden must still reach the element.
         */
        if (visualElement && visualElement.props !== props) {
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
            typeof window !== "undefined" &&
            !window.MotionHandoffIsComplete?.(optimisedAppearId) &&
            window.MotionHasOptimisedAnimation?.(optimisedAppearId)
    )

    /**
     * Layout effects re-run when a hidden Suspense/Activity boundary is
     * revealed, but passive effects only re-run if this component re-renders
     * (not the case for memoized elements). Replay animations on every
     * reconnection. Must be declared before the effect that sets hasMountedOnce.
     */
    useIsomorphicLayoutEffect(() => {
        if (!hasMountedOnce.current || !visualElement) return

        visualElement.animationState?.animateChanges()
        visualElement.enteringChildren = undefined
    }, [])

    useIsomorphicLayoutEffect(() => {
        /**
         * Track that this component has mounted. This is used to detect when
         * LazyMotion features load after the component has already committed.
         */
        hasMountedOnce.current = true

        if (!visualElement) return

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
         * So if we detect a situation where optimised appear animations
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
