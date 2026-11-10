import type { AnyResolvedKeyframe } from "../../animation/types"
import { isCSSVar } from "../../render/dom/is-css-var"

/**
 * The style effect's output to an element. Animations hand their values to
 * these rather than writing styles or starting WAAPI animations themselves.
 */

/**
 * Write a style, or a CSS variable, as an inline style.
 */
export function setStyle(
    element: HTMLElement | SVGElement,
    name: string,
    value: AnyResolvedKeyframe
) {
    isCSSVar(name)
        ? element.style.setProperty(name, value as string)
        : (element.style[name as any] = value as string)
}

/**
 * Start a WAAPI animation of an element's styles.
 */
export const animateStyle = (
    element: Element,
    keyframes: PropertyIndexedKeyframes | null,
    options: KeyframeAnimationOptions
) => element.animate(keyframes, options)

/**
 * Make a WAAPI animation of an element's styles that starts when its
 * startTime is set. Playing it first, as element.animate() does, would
 * leave WebKit holding that play's ready time once startTime ends the
 * play, and it uses that for the next updatePlaybackRate(), so the
 * animation would jump.
 */
export const createStyleAnimation = (
    element: Element,
    keyframes: PropertyIndexedKeyframes | null,
    options: KeyframeAnimationOptions
) =>
    new Animation(
        new KeyframeEffect(element, keyframes, options) as AnimationEffect
    )
