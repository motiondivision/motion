import { animations } from "../../../motion/features/animations"
import { gestureAnimations } from "../../../motion/features/gestures"
import {
    preloadFeatures as preload,
    useAsyncFeatures,
} from "../../../motion/features/use-async-features"
import { MotionProps } from "../../../motion/types"
import { createDomVisualElement } from "../../dom/create-visual-element"
import { createMotionProxy } from "../create-proxy"
import { featureLoaders } from "./loaders"

/**
 * A motion component with animations and gestures, that fetches layout
 * and drag code the first time a component's props need it.
 */
export const motion = /*@__PURE__*/ createMotionProxy(
    { ...animations, ...gestureAnimations },
    createDomVisualElement,
    (props: MotionProps) => useAsyncFeatures(props, featureLoaders)
)

/**
 * Fetch the layout and drag features now, rather than when a component
 * first needs them. Await it in a test's setup, or call it ahead of an
 * interaction, so the first layout change or drag isn't missed.
 */
export const preloadFeatures = () => preload(featureLoaders)
