import { createDomVisualElement } from "../../dom/create-visual-element"
import { createMotionProxy } from "../create-proxy"
import { featureLoaders } from "./loaders"

/**
 * A motion component that renders motion values from the start, and
 * fetches animation, gesture, layout and drag code when props need it.
 */
export const motion = /*@__PURE__*/ createMotionProxy(
    undefined,
    createDomVisualElement,
    featureLoaders
)
