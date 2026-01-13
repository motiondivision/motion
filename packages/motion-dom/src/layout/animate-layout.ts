import type { AnimationOptions } from "../animation/types"
import type { ElementOrSelector } from "../utils/resolve-elements"
import {
    LayoutAnimationBuilder,
    parseAnimateLayoutArgs,
} from "./LayoutAnimationBuilder"

/**
 * Animate layout changes within a DOM tree.
 *
 * @example
 * ```typescript
 * // Basic usage - animates all elements with data-layout or data-layout-id
 * await animateLayout(() => {
 *     container.innerHTML = newContent
 * })
 *
 * // With scope - only animates within the container
 * await animateLayout(".container", () => {
 *     updateContent()
 * })
 *
 * // With options
 * await animateLayout(() => update(), { duration: 0.5 })
 *
 * // Builder pattern for enter/exit animations
 * animateLayout(".cards", () => {
 *     container.innerHTML = newCards
 * }, { duration: 0.3 })
 *     .enter({ opacity: 1, scale: 1 }, { duration: 0.2 })
 *     .exit({ opacity: 0, scale: 0.8 })
 *     .shared("hero", { type: "spring" })
 * ```
 *
 * Elements are animated if they have:
 * - `data-layout` attribute (layout animation only)
 * - `data-layout-id` attribute (shared element transitions)
 *
 * @param scopeOrUpdateDom - Either a scope selector/element, or the DOM update function
 * @param updateDomOrOptions - Either the DOM update function or animation options
 * @param options - Animation options (when scope is provided)
 * @returns A builder that resolves to animation controls
 */
export function unstable_animateLayout(
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
