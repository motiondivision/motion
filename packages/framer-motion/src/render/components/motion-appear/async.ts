import { gestureAnimations } from "../../../motion/features/gestures"
import {
    preloadFeatures as preload,
    useAsyncFeatures,
} from "../../../motion/features/use-async-features"
import { FeatureLoaders } from "../../../motion/features/types"
import { MotionContextProps } from "../../../context/MotionContext"
import { MotionProps } from "../../../motion/types"
import { createDomVisualElement } from "../../dom/create-visual-element"
import { createMotionProxy } from "../create-proxy"
import { featureLoaders } from "../motion-async/loaders"
import { hasAnimationFeature } from "../../../animation/appear/css"
import { createEarlyState } from "../../../animation/appear/early"
import { createAppearProxy } from "./proxy"

const loaders: FeatureLoaders = {
    animation: {
        keys: ["animation"],
        load: () =>
            import("../../../animation/appear/animations").then((m) =>
                m.loadAnimations()
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
        /**
         * Until the animation code arrives, gestures change a component
         * at once.
         */
        ((Component: any, options: any) => {
            const visualElement = createDomVisualElement(Component, options)

            if (!hasAnimationFeature()) {
                const early = (visualElement.animationState = createEarlyState(
                    visualElement as any
                ))
                const { mount, unmount } = visualElement

                visualElement.mount = (instance: any) => {
                    mount.call(visualElement, instance)
                    visualElement.animationState === early && early.mount()
                }
                visualElement.unmount = () => {
                    early.unmount()
                    unmount.call(visualElement)
                }
            }

            return visualElement
        }) as typeof createDomVisualElement,
        (props: MotionProps, context: MotionContextProps) =>
            useAsyncFeatures(props, context, loaders)
    )
)

/**
 * Fetch the animation, layout and drag code now, rather than when a
 * component first needs it. Await it in a test's setup, or call it ahead
 * of an interaction, so nothing waits on a fetch.
 */
export const preloadFeatures = () => preload(loaders)
