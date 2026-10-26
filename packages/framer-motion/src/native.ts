"use client"

/**
 * Motion for React Native.
 *
 * `motion` components render through Reanimated, and animations of values
 * Motion owns are sampled on the JS thread and played on the UI thread, so
 * they keep running while JS is busy.
 */

import type {
    ImageProps,
    ScrollViewProps,
    TextProps,
    ViewProps,
} from "react-native"
import { Image, ScrollView, Text, View } from "react-native"
import Animated from "react-native-reanimated"
import {
    createNativeMotionComponent,
    NativeMotionComponent,
} from "./native/component"
import { initNativeReducedMotion } from "./native/reduced-motion"

initNativeReducedMotion()

export * from "motion-dom"
export * from "motion-utils"

export const motion: {
    View: NativeMotionComponent<ViewProps>
    Text: NativeMotionComponent<TextProps>
    Image: NativeMotionComponent<ImageProps>
    ScrollView: NativeMotionComponent<ScrollViewProps>
    create: typeof createNativeMotionComponent
} = {
    View: /*@__PURE__*/ createNativeMotionComponent(View, Animated.View),
    Text: /*@__PURE__*/ createNativeMotionComponent(Text, Animated.Text),
    Image: /*@__PURE__*/ createNativeMotionComponent(Image, Animated.Image),
    ScrollView: /*@__PURE__*/ createNativeMotionComponent(
        ScrollView,
        Animated.ScrollView
    ),
    create: createNativeMotionComponent,
}

export { createNativeMotionComponent }
export type {
    NativeMotionComponent,
    NativeMotionProps,
    NativeMotionStyle,
} from "./native/component"

export { animate, createScopedAnimate } from "./animation/animate"
export { animationControls } from "./animation/hooks/animation-controls"
export { useAnimationControls } from "./animation/hooks/use-animation"
export { AnimatePresence } from "./components/AnimatePresence"
export {
    useIsPresent,
    usePresence,
} from "./components/AnimatePresence/use-presence"
export { usePresenceData } from "./components/AnimatePresence/use-presence-data"
export { MotionConfig } from "./components/MotionConfig"
export { MotionConfigContext } from "./context/MotionConfigContext"
export { useAnimationFrame } from "./utils/use-animation-frame"
export { useCycle } from "./utils/use-cycle"
export { useMotionValueEvent } from "./utils/use-motion-value-event"
export { useReducedMotion } from "./utils/reduced-motion/use-reduced-motion"
export { useMotionTemplate } from "./value/use-motion-template"
export { useMotionValue } from "./value/use-motion-value"
export { useSpring } from "./value/use-spring"
export { useTime } from "./value/use-time"
export { useTransform } from "./value/use-transform"
export { useVelocity } from "./value/use-velocity"
