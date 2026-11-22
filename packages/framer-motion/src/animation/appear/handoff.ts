import { appearElements } from "motion-dom"
import { appearStyle, type AppearAnimation } from "./css"

/**
 * Tell the animation code that an element's enter animation is running
 * as CSS, and what it plays.
 */
export function registerAppearElement(
    element: HTMLElement,
    appear: AppearAnimation
) {
    appearElements.set(element, appear)

    /**
     * An element that is moved in the document, as a reordered list does
     * to its items, has its CSS animations made again from their start.
     * They're given the start time they had.
     */
    const starts: { [name: string]: number } = {}
    const keepTime = () => {
        for (const animation of element.getAnimations()) {
            const name = (animation as CSSAnimation).animationName
            const { startTime } = animation

            if (!name?.startsWith("m-")) continue

            if (starts[name] === undefined) {
                startTime === null || (starts[name] = startTime as number)
            } else if (startTime !== starts[name]) {
                animation.startTime = starts[name]
            }
        }
    }
    keepTime()
    element.addEventListener("animationstart", keepTime)
    element.addEventListener("animationcancel", keepTime)

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

/**
 * Take animations off an element. They leave its `animation` style too,
 * or an element that is moved or shown again would play them again.
 */
export function dropAppearAnimations(
    element: HTMLElement,
    appear: AppearAnimation,
    names: string[]
) {
    element
        .getAnimations()
        .forEach(
            (animation) =>
                names.includes((animation as CSSAnimation).animationName) &&
                animation.cancel()
        )

    appear.list = appear.list.filter(
        (animation) => !names.includes(animation.split(" ")[0])
    )
    element.style.animation = appearStyle(appear.list)
    appear.list.length || appearElements.delete(element)
}
