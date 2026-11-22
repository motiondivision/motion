import type { EasingFunction } from "motion-utils"
import type { MotionNode } from "../../node/MotionNode"
import { motionValue, type AccelerateConfig } from "../../value"
import { frame } from "../../frameloop/frame"
import { animateValues } from "../animate/effects"
import { supportTimelines } from "../animate/attach-timeline"

/**
 * Drop keyframes at the offset of the one before that hold its value,
 * like the ones useTransform pads a range's ends with, as a transform
 * animation's offsets only ever increase.
 */
export function removeHeldOffsets(
    keyframes: any[],
    times: number[],
    ease?: EasingFunction | EasingFunction[]
) {
    const isList = Array.isArray(ease)
    const k = [keyframes[0]]
    const t = [times[0]]
    const e: EasingFunction[] = []

    for (let i = 1; i < keyframes.length; i++) {
        if (times[i] === times[i - 1] && keyframes[i] === keyframes[i - 1]) {
            continue
        }
        k.push(keyframes[i])
        t.push(times[i])
        isList && e.push((ease as EasingFunction[])[i - 1])
    }

    return { keyframes: k, times: t, ease: isList ? e : ease }
}

/**
 * Play a transform of an element, like `y`, from an accelerate config, as
 * part of the element's transform animation, which the config's factory
 * links to a timeline. The browser then runs it with the element's other
 * transforms on the compositor. Set as the `bindTransform` of an
 * accelerate config, so only the code that makes those configs carries it.
 */
export function bindAccelerateTransform(
    _element: HTMLElement,
    name: string,
    config: AccelerateConfig,
    node: MotionNode,
    onDemote: VoidFunction
): VoidFunction {
    supportTimelines()

    const { keyframes, times, ease } = removeHeldOffsets(
        config.keyframes,
        config.times,
        config.ease
    )

    /**
     * A value of its own, so the one the element was given keeps what
     * it's set to from JS.
     */
    const value = motionValue(keyframes[0], { owner: node })
    const [animation] = animateValues(
        () => value,
        { [name]: keyframes },
        { duration: config.duration, ease, times },
        node
    )
    const cleanup = config.factory(animation)

    /**
     * On the compositor the value isn't set each frame. If it is, the
     * animation has moved to the main thread, where the element's own
     * value, which JS keeps following the timeline, is written instead.
     */
    const stopListening = value.on("change", () => {
        stopListening()
        frame.postRender(onDemote)
    })

    return () => {
        stopListening()
        cleanup()
        animation.stop()
    }
}
