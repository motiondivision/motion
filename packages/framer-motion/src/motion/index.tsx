"use client"

import { invariant, warning } from "motion-utils"
import * as React from "react"
import { forwardRef, useContext } from "react"
import { LayoutGroupContext } from "../context/LayoutGroupContext"
import { LazyContext } from "../context/LazyContext"
import { MotionConfigContext } from "../context/MotionConfigContext"
import { MotionContext } from "../context/MotionContext"
import { useCreateMotionContext } from "../context/MotionContext/create"
import { DOMMotionComponents } from "../render/dom/types"
import { useRender } from "../render/dom/use-render"
import { isSVGComponent } from "../render/dom/utils/is-svg-component"
import { HTMLRenderState } from "../render/html/types"
import { useHTMLVisualState } from "../render/html/use-html-visual-state"
import { SVGRenderState } from "../render/svg/types"
import { useSVGVisualState } from "../render/svg/use-svg-visual-state"
import { CreateVisualElement } from "../render/types"
import { isBrowser } from "../utils/is-browser"
import { featureDefinitions } from "./features/definitions"
import { loadFeatures } from "./features/load-features"
import { FeatureBundle, FeaturePackages } from "./features/types"
import { MotionProps } from "./types"
import { motionComponentSymbol } from "./utils/symbol"
import { useMotionRef } from "./utils/use-motion-ref"
import { useVisualElement } from "./utils/use-visual-element"

export interface MotionComponentConfig<
    TagName extends keyof DOMMotionComponents | string = "div"
> {
    preloadedFeatures?: FeatureBundle
    createVisualElement?: CreateVisualElement
    Component: TagName | React.ComponentType<React.PropsWithChildren<unknown>>
    forwardMotionProps?: boolean
}

export type MotionComponentProps<Props> = {
    [K in Exclude<keyof Props, keyof MotionProps>]?: Props[K]
} & MotionProps

export type MotionComponent<T, P> = T extends keyof DOMMotionComponents
    ? DOMMotionComponents[T]
    : React.ComponentType<
          Omit<MotionComponentProps<P>, "children"> & {
              children?: "children" extends keyof P
                  ? P["children"] | MotionComponentProps<P>["children"]
                  : MotionComponentProps<P>["children"]
          }
      >

export interface MotionComponentOptions {
    forwardMotionProps?: boolean
    /**
     * Specify whether the component renders an HTML or SVG element.
     * This is useful when wrapping custom SVG components that need
     * SVG-specific attribute handling (like viewBox animation).
     * By default, Motion auto-detects based on the component name,
     * but custom React components are always treated as HTML.
     */
    type?: "html" | "svg"
}

/**
 * Create a `motion` component.
 *
 * This function accepts a Component argument, which can be either a string (ie "div"
 * for `motion.div`), or an actual React component.
 *
 * Alongside this is a config option which provides a way of rendering the provided
 * component "offline", or outside the React render cycle.
 */
export function createMotionComponent<
    Props,
    TagName extends keyof DOMMotionComponents | string = "div"
>(
    Component: TagName | string | React.ComponentType<Props>,
    { forwardMotionProps = false, type }: MotionComponentOptions = {},
    preloadedFeatures?: FeaturePackages,
    createVisualElement?: CreateVisualElement<Props, TagName>
) {
    preloadedFeatures && loadFeatures(preloadedFeatures)

    /**
     * Determine whether to use SVG or HTML rendering based on:
     * 1. Explicit `type` option (highest priority)
     * 2. Auto-detection via `isSVGComponent`
     */
    const isSVG = type ? type === "svg" : isSVGComponent(Component)
    const useVisualState = isSVG ? useSVGVisualState : useHTMLVisualState

    function MotionDOMComponent(
        props: MotionComponentProps<Props>,
        externalRef?: React.Ref<HTMLElement | SVGElement>
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

        const context = useCreateMotionContext<HTMLElement | SVGElement>(props)

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
            context.visualElement = useVisualElement(
                Component,
                visualState,
                configAndProps,
                createVisualElement,
                layoutProjection.ProjectionNode,
                isSVG
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
                {useRender<Props, TagName>(
                    Component,
                    props,
                    useMotionRef<
                        HTMLElement | SVGElement,
                        HTMLRenderState | SVGRenderState
                    >(visualState, context.visualElement, externalRef),
                    visualState,
                    isStatic,
                    forwardMotionProps,
                    isSVG
                )}
            </MotionContext.Provider>
        )
    }

    MotionDOMComponent.displayName = `motion.${
        typeof Component === "string"
            ? Component
            : `create(${Component.displayName ?? Component.name ?? ""})`
    }`

    const ForwardRefMotionComponent = forwardRef(MotionDOMComponent as any)
    ;(ForwardRefMotionComponent as any)[motionComponentSymbol] = Component

    return ForwardRefMotionComponent as MotionComponent<TagName, Props>
}

function useLayoutId({ layoutId }: MotionProps) {
    const layoutGroupId = useContext(LayoutGroupContext).id
    return layoutGroupId && layoutId !== undefined
        ? layoutGroupId + "-" + layoutId
        : layoutId
}

function useStrictMode(
    configAndProps: MotionProps,
    preloadedFeatures?: FeaturePackages
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
            ? warning(false, strictMessage, "lazy-strict-mode")
            : invariant(false, strictMessage, "lazy-strict-mode")
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
