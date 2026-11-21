import { camelToDash, transformProps, type Batcher } from "motion-dom"
import { noop } from "motion-utils"
import { appearName } from "./css"

/**
 * The elements whose enter animations started as CSS, by the id the
 * animation code asks with. True once the animation code has taken over.
 */
const appeared = new Map<string, boolean>()

const getElement = (id: string) =>
    document.querySelector<HTMLElement>(
        `[data-framer-appear-id="${CSS.escape(id)}"]`
    )

const getAnimation = (id: string, valueName: string) => {
    const name = appearName(
        transformProps.has(valueName) ? "transform" : camelToDash(valueName)
    )

    return getElement(id)
        ?.getAnimations()
        .find((animation) => (animation as CSSAnimation).animationName === name)
}

/**
 * Stop the CSS animation of a value. When it was the element's last, its
 * `animation` style goes too, as an element that is hidden and shown
 * again would otherwise play them all again.
 */
function cancel(id: string, valueName: string) {
    getAnimation(id, valueName)?.cancel()

    const element = getElement(id)
    if (
        element &&
        !element
            .getAnimations()
            .some((animation) =>
                (animation as CSSAnimation).animationName?.startsWith("m-")
            )
    ) {
        element.style.animation = ""
    }
}

/**
 * Tell the animation code that an element's enter animation is running
 * as CSS. It asks for each value's start time through these functions,
 * as it does for the animations an inline script starts.
 */
export function registerAppearAnimation(id: string) {
    if (appeared.has(id)) return
    appeared.set(id, false)

    if (window.MotionHandoffAnimation) return

    window.MotionHasOptimisedAnimation = (id, valueName) =>
        !!id && (valueName ? !!getAnimation(id, valueName) : appeared.has(id))

    window.MotionHandoffMarkAsComplete = (id) => {
        appeared.has(id) && appeared.set(id, true)
    }

    window.MotionHandoffIsComplete = (id) => appeared.get(id) === true

    window.MotionCancelOptimisedAnimation = (
        id,
        valueName,
        frame,
        canResume
    ) => {
        const animation = getAnimation(id!, valueName!)
        if (!animation) return

        if (frame && canResume) {
            /**
             * Take the animation off for a layout measurement, then
             * carry on from where it was.
             */
            const { startTime } = animation
            animation.cancel()
            frame.render(() => {
                animation.play()
                animation.startTime = startTime
            })
        } else {
            cancel(id!, valueName!)
        }
    }

    window.MotionHandoffAnimation = (id: string, valueName: string, frame: Batcher) => {
        const animation = getAnimation(id, valueName)
        if (!animation) return null

        if (appeared.get(id)) {
            cancel(id, valueName)
            return null
        }

        const startTime =
            (animation.startTime as number | null) ??
            (animation.timeline!.currentTime as number) -
                (animation.currentTime as number)
        const element = getElement(id)!
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
            const property = animationName.slice(2)
            const timing = animation.effect!.getTiming()
            cancel(id, valueName)
            const keyframes = {
                [property.replace(/-(\w)/g, (_, char) =>
                    char.toUpperCase()
                )]: [
                    getComputedStyle(element).getPropertyValue(property),
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
        } else {
            /**
             * Once the animation code has rendered its first frame of
             * the value, the CSS animation can go.
             */
            frame.postRender(() =>
                frame.postRender(() => cancel(id, valueName))
            )
        }

        return startTime
    }
}
