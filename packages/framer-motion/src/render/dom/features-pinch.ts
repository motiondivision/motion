"use client"

import { PinchGesture } from "../../gestures/pinch"
import { FeatureBundle } from "../../motion/features/types"
import { createDomVisualElement } from "./create-visual-element"

/**
 * The `pinch` prop. Not part of `motion` components or the `domMax`
 * bundle, so load it on its own or alongside them:
 *
 * ```jsx
 * <LazyMotion features={pinchFeatures}>
 * <LazyMotion features={{ ...domMax, ...pinchFeatures }}>
 * ```
 *
 * @public
 */
export const pinchFeatures: FeatureBundle = {
    renderer: createDomVisualElement,
    pinch: {
        Feature: PinchGesture,
        isEnabled: (props) => !!props.pinch,
    },
}
