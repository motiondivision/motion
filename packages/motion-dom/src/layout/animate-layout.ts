import type { AnimationOptions } from "../animation/types"
import type { ElementOrSelector } from "../utils/resolve-elements"
import {
    LayoutAnimationBuilder,
    parseAnimateLayoutArgs,
} from "./LayoutAnimationBuilder"

/**
 * Animate layout changes made within `updateDom` on elements tagged
 * with `data-layout` or `data-layout-id`.
 *
 * ```
 * animateLayout(() => {
 *     element.style.justifyContent = "flex-end"
 * })
 * ```
 */
export function animateLayout(
    scopeOrUpdateDom: ElementOrSelector | (() => void),
    updateDomOrOptions?: (() => void) | AnimationOptions,
    options?: AnimationOptions
): LayoutAnimationBuilder {
    const { scope, updateDom, defaultOptions } = parseAnimateLayoutArgs(
        scopeOrUpdateDom,
        updateDomOrOptions,
        options
    )
    return new LayoutAnimationBuilder(scope, updateDom, defaultOptions)
}
