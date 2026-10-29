"use client"

import {
    isMotionValue,
    MotionNodeAnimationOptions,
    MotionNodeEventOptions,
    MotionValue,
    scrapeHTMLMotionValuesFromProps,
    TapInfo,
    TargetAndTransition,
    transformProps,
    VariantLabels,
    VisualElement,
} from "motion-dom"
import * as React from "react"
import { forwardRef, useCallback, useContext, useInsertionEffect, useRef } from "react"
import type {
    GestureResponderEvent,
    LayoutChangeEvent,
    StyleProp,
} from "react-native"
import { StyleSheet } from "react-native"
import Animated, {
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated"
import { MotionConfigContext } from "../context/MotionConfigContext"
import { MotionContext } from "../context/MotionContext"
import { useCreateMotionContext } from "../context/MotionContext/create"
import { animations } from "../motion/features/animations"
import { loadFeatures } from "../motion/features/load-features"
import { isValidMotionProp } from "../motion/utils/valid-prop"
import { useVisualElement } from "../motion/utils/use-visual-element"
import { makeUseVisualState } from "../motion/utils/use-visual-state"
import { useConstant } from "../utils/use-constant"
import { createNativeHost } from "./host"
import { NativeVisualElement } from "./NativeVisualElement"
import { initNativeReducedMotion } from "./reduced-motion"
import { buildNativeStyle } from "./style"
import type { NativeValues } from "./types"

/**
 * React Native styles, plus Motion's transform shorthands (`x`, `scale`,
 * `rotate`…) and motion values.
 */
export type NativeMotionStyle = {
    [key: string]: any | MotionValue
}

export interface NativeMotionProps
    extends MotionNodeAnimationOptions,
        MotionNodeEventOptions {
    style?: StyleProp<any> | NativeMotionStyle
    whileTap?: VariantLabels | TargetAndTransition
    onTap?(event: GestureResponderEvent, info: TapInfo): void
    onTapStart?(event: GestureResponderEvent, info: TapInfo): void
    onTapCancel?(event: GestureResponderEvent, info: TapInfo): void
    children?: React.ReactNode
}

export type NativeMotionComponent<P> = React.ForwardRefExoticComponent<
    Omit<P, "style" | keyof NativeMotionProps> &
        NativeMotionProps &
        React.RefAttributes<any>
>

const useNativeVisualState = makeUseVisualState({
    scrapeMotionValuesFromProps: scrapeHTMLMotionValuesFromProps,
    createRenderState: () => ({}),
})

const createNativeVisualElement = (_: unknown, options: any): any =>
    new NativeVisualElement(options)

const isNativeStyleKey = (key: string, value: unknown) =>
    !isMotionValue(value) && !transformProps.has(key) && !key.startsWith("origin")

const getTapInfo = ({ nativeEvent }: GestureResponderEvent): TapInfo => ({
    point: { x: nativeEvent.pageX, y: nativeEvent.pageY },
})

/**
 * Create a motion component for a React Native component. Its values are
 * rendered by Reanimated, and animations of values Motion owns run on the
 * UI thread.
 */
export function createNativeMotionComponent<P extends object>(
    Component: React.ComponentType<P>,
    AnimatedComponent: React.ComponentType<any> = Animated.createAnimatedComponent(
        Component as React.ComponentType<any>
    )
): NativeMotionComponent<P> {
    loadFeatures(animations)

    function MotionNativeComponent(
        props: NativeMotionProps & { [key: string]: any },
        externalRef: React.Ref<any>
    ) {
        initNativeReducedMotion()

        const style = (StyleSheet.flatten(props.style) || {}) as NativeMotionStyle
        /**
         * Motion's React hooks are typed for the DOM's props.
         */
        const configAndProps: any = {
            ...useContext(MotionConfigContext),
            ...props,
            style,
        }

        const context = useCreateMotionContext<NativeVisualElement>(
            props as any
        )
        const visualState = useNativeVisualState(configAndProps, false)
        const visualElement = useVisualElement(
            Component as any,
            visualState as any,
            configAndProps,
            createNativeVisualElement
        ) as unknown as NativeVisualElement | undefined
        context.visualElement = visualElement as VisualElement<any> | undefined

        const store = useSharedValue<NativeValues>({
            ...(visualState.latestValues as NativeValues),
        })
        const tokens = useSharedValue<{ [key: string]: number }>({})
        const host = useConstant(() =>
            createNativeHost(store, tokens, visualState.latestValues as NativeValues)
        )
        const updater = () => {
            "worklet"
            return buildNativeStyle(store.value)
        }
        /**
         * Where Reanimated's Babel plugin hasn't run on node_modules (Jest),
         * the updater isn't a worklet and needs dependencies. On a device
         * they're ignored, and passing them logs a warning.
         */
        const animatedStyle = useAnimatedStyle(
            updater,
            (updater as { __workletHash?: number }).__workletHash
                ? undefined
                : [store]
        )

        const externalRefContainer = useRef(externalRef)
        useInsertionEffect(() => {
            externalRefContainer.current = externalRef
        })

        /**
         * A cleanup returned by a callback ref (React 19).
         */
        const refCleanup = useRef<VoidFunction | null>(null)
        const size = useRef({ width: Infinity, height: Infinity })

        const ref = useCallback(
            (instance: unknown) => {
                if (visualElement) {
                    instance
                        ? visualElement.mount(host)
                        : visualElement.unmount()
                }

                const forwarded = externalRefContainer.current
                if (typeof forwarded === "function") {
                    if (instance) {
                        const cleanup = forwarded(instance)
                        if (typeof cleanup === "function") {
                            refCleanup.current = cleanup
                        }
                    } else if (refCleanup.current) {
                        refCleanup.current()
                        refCleanup.current = null
                    } else {
                        forwarded(instance)
                    }
                } else if (forwarded) {
                    ;(forwarded as React.MutableRefObject<unknown>).current =
                        instance
                }
            },
            [visualElement]
        )

        const forwardedProps: { [key: string]: any } = {}
        for (const key in props) {
            if (!isValidMotionProp(key) && key !== "style") {
                forwardedProps[key] = props[key]
            }
        }

        const staticStyle: { [key: string]: any } = {}
        for (const key in style) {
            if (isNativeStyleKey(key, style[key])) {
                staticStyle[key] = style[key]
            }
        }

        if (props.whileTap || props.onTap || props.onTapStart || props.onTapCancel) {
            const setTapActive = (isActive: boolean) =>
                visualElement?.animationState?.setActive("whileTap", isActive)

            forwardedProps.onLayout = (event: LayoutChangeEvent) => {
                props.onLayout?.(event)
                size.current = event.nativeEvent.layout
            }
            forwardedProps.onTouchStart = (event: GestureResponderEvent) => {
                props.onTouchStart?.(event)
                if (event.nativeEvent.touches.length > 1) return
                setTapActive(true)
                props.onTapStart?.(event, getTapInfo(event))
            }
            /**
             * Like a press on the web, a tap only completes if the last
             * finger lifts inside the view.
             */
            forwardedProps.onTouchEnd = (event: GestureResponderEvent) => {
                props.onTouchEnd?.(event)
                const { touches, locationX, locationY } = event.nativeEvent
                if (touches.length) return
                setTapActive(false)
                const { width, height } = size.current
                locationX >= 0 &&
                locationY >= 0 &&
                locationX <= width &&
                locationY <= height
                    ? props.onTap?.(event, getTapInfo(event))
                    : props.onTapCancel?.(event, getTapInfo(event))
            }
            forwardedProps.onTouchCancel = (event: GestureResponderEvent) => {
                props.onTouchCancel?.(event)
                setTapActive(false)
                props.onTapCancel?.(event, getTapInfo(event))
            }
        }

        return (
            <MotionContext.Provider value={context}>
                <AnimatedComponent
                    {...forwardedProps}
                    ref={ref}
                    style={[staticStyle, animatedStyle]}
                />
            </MotionContext.Provider>
        )
    }

    MotionNativeComponent.displayName = `motion.${
        Component.displayName || Component.name || "create"
    }`

    return forwardRef(MotionNativeComponent as any) as any
}
