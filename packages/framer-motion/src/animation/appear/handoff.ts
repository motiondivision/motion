import { appearElements } from "motion-dom"
import type { AppearAnimation } from "./css"

/**
 * Tell the animation code that an element's enter animation is running
 * as CSS, and what it plays.
 */
export function registerAppearElement(
    element: HTMLElement,
    appear: AppearAnimation
) {
    appearElements.set(element, appear)

    if (window.MotionCancelOptimisedAnimation) return

    /**
     * Layout animations measure elements without their transforms. These
     * are the functions an inline script would define for that, with the
     * element as its id.
     */
    const getAnimation = (element: unknown) =>
        appearElements.has(element as object)
            ? (element as HTMLElement)
                  .getAnimations()
                  .find(
                      (animation) =>
                          (animation as CSSAnimation).animationName ===
                          "m-transform"
                  )
            : undefined

    window.MotionHasOptimisedAnimation = (element) => !!getAnimation(element)

    window.MotionCancelOptimisedAnimation = (element, _, frame) => {
        const animation = getAnimation(element)
        if (!animation) return

        /**
         * Take the animation off for the measurement, then carry on
         * from where it was.
         */
        const { startTime } = animation
        animation.cancel()
        frame?.render(() => {
            animation.play()
            animation.startTime = startTime
        })
    }
}
