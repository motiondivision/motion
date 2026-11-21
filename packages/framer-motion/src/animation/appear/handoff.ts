import {
    appearElements,
    camelToDash,
    transformProps,
    type Batcher,
} from "motion-dom"
import { noop } from "motion-utils"
import { appearName } from "./css"

const isAppear = (animation: Animation) =>
    (animation as CSSAnimation).animationName?.startsWith("m-")

const getAnimation = (element: HTMLElement, valueName: string) => {
    const name = appearName(
        transformProps.has(valueName) ? "transform" : camelToDash(valueName)
    )

    return element
        .getAnimations()
        .find((animation) => (animation as CSSAnimation).animationName === name)
}

/**
 * Stop an element's CSS animations. Its `animation` style goes too, as an
 * element that is hidden and shown again would otherwise play them again.
 */
function cancelAll(element: HTMLElement) {
    element.getAnimations().forEach((animation) => {
        isAppear(animation) && animation.cancel()
    })
    element.style.animation = ""
}

/**
 * The elements the animation code has started to take over.
 */
const handedOff = new WeakSet<HTMLElement>()

/**
 * Tell the animation code that an element's enter animation is running
 * as CSS. It asks for each value's start time through the functions an
 * inline script would define, with the element as its id.
 */
export function registerAppearElement(element: HTMLElement) {
    appearElements.add(element)

    if (window.MotionHandoffAnimation) return

    const has = (element: unknown): element is HTMLElement =>
        appearElements.has(element as object)

    window.MotionHasOptimisedAnimation = (element, valueName) =>
        has(element) && (!valueName || !!getAnimation(element, valueName))

    window.MotionCancelOptimisedAnimation = (
        element,
        valueName,
        frame,
        canResume
    ) => {
        if (!has(element)) return

        const animation = getAnimation(element, valueName!)
        if (!animation) return

        /**
         * Take the animation off for a layout measurement. An element
         * without a layout animation carries on from where it was.
         */
        const { startTime } = animation
        animation.cancel()
        frame &&
            canResume &&
            frame.render(() => {
                animation.play()
                animation.startTime = startTime
            })
    }

    window.MotionHandoffAnimation = ((
        element: unknown,
        valueName: string,
        frame: Batcher
    ) => {
        if (!has(element)) return null

        const animation = getAnimation(element, valueName)
        if (!animation) return null

        if (!handedOff.has(element)) {
            handedOff.add(element)

            /**
             * The animation code starts every value of the enter
             * animation in one go. After that the element is as any
             * other, and once the first frame of each value has
             * rendered, the CSS animations can go.
             */
            queueMicrotask(() => appearElements.delete(element))
            frame.postRender(() =>
                frame.postRender(() => cancelAll(element))
            )
        }

        const startTime =
            (animation.startTime as number | null) ??
            (animation.timeline!.currentTime as number) -
                (animation.currentTime as number)
        const { animationName } = animation as CSSAnimation
        const target = element.style.getPropertyValue("--" + animationName)

        if (!transformProps.has(valueName) && /[#(]/.test(target)) {
            /**
             * CSS mixes colours in another way, so a value with one
             * stays with the browser to its end, and the animation code
             * runs in step underneath. The CSS animation starts from the
             * element's style, which the animation code now changes, so
             * one with a fixed start replaces it.
             */
            const timing = animation.effect!.getTiming()
            animation.cancel()
            const keyframes = {
                [animationName
                    .slice(2)
                    .replace(/-(\w)/g, (_, char) => char.toUpperCase())]: [
                    getComputedStyle(element).getPropertyValue(
                        animationName.slice(2)
                    ),
                    target,
                ],
            }
            let fixed: Animation | undefined
            const fix = () => {
                fixed?.cancel()
                fixed = element.animate(keyframes, timing)
                fixed.startTime = startTime
                fixed.finished.then((finished) => finished.cancel(), noop)
            }
            fix()

            /**
             * Again when the animation code has made its own, as the
             * newest animation is the one that shows.
             */
            frame.postRender(() => frame.postRender(fix))
        }

        return startTime
    }) as any
}
