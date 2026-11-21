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
    const getAnimations = (element: unknown) => {
        const appear = appearElements.get(element as object) as
            | AppearAnimation
            | undefined

        return appear
            ? (element as HTMLElement)
                  .getAnimations()
                  .filter((animation) =>
                      appear.transform.includes(
                          (animation as CSSAnimation).animationName
                      )
                  )
            : []
    }

    window.MotionHasOptimisedAnimation = (element) =>
        !!getAnimations(element).length

    window.MotionCancelOptimisedAnimation = (element, _, frame) => {
        /**
         * Take the animations off for the measurement, then carry on
         * from where they were.
         */
        getAnimations(element).forEach((animation) => {
            const { startTime } = animation
            animation.cancel()
            frame?.render(() => {
                animation.play()
                animation.startTime = startTime
            })
        })
    }
}
