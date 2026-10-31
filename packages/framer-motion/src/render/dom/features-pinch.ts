"use client"

import { PinchGesture } from "../../gestures/pinch"
import { FeaturePackages } from "../../motion/features/types"

/**
 * The `pinch` prop. Not part of `motion` components or the `domMax`
 * bundle, so load it alongside them:
 *
 * ```jsx
 * <LazyMotion features={{ ...domMax, ...pinchFeatures }}>
 * ```
 *
 * @public
 */
export const pinchFeatures: FeaturePackages = {
    pinch: {
        Feature: PinchGesture,
        isEnabled: (props) => !!props.pinch,
    },
}
