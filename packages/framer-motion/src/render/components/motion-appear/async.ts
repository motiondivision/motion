import { gestureAnimations } from "../../../motion/features/gestures"
import { useAsyncFeatures } from "../../../motion/features/use-async-features"
import { FeatureLoaders } from "../../../motion/features/types"
import { MotionContextProps } from "../../../context/MotionContext"
import { MotionProps } from "../../../motion/types"
import { createDomVisualElement } from "../../dom/create-visual-element"
import { createMotionProxy } from "../create-proxy"
import { featureLoaders } from "../motion-async/loaders"
import { createAppearProxy } from "./proxy"

const loaders: FeatureLoaders = {
    animation: {
        keys: ["animation"],
        load: () =>
            import("../../../motion/features/animations").then(
                (m) => m.animations
            ),
    },
    ...featureLoaders,
}

/**
 * A motion component that has gestures from the start and fetches its
 * animation, layout and drag code. Its enter animation runs as CSS until
 * the animation code arrives.
 */
export const motion = /*@__PURE__*/ createAppearProxy(
    /*@__PURE__*/ createMotionProxy(
        gestureAnimations,
        createDomVisualElement,
        (props: MotionProps, context: MotionContextProps) =>
            useAsyncFeatures(props, context, loaders)
    )
)
