import { EasingFunction, noop, secondsToMilliseconds } from "motion-utils"
import { animateStyle, setStyle } from "../../effects/style/output"
import { supportsScrollTimeline } from "../../utils/supports/scroll-timeline"
import type { AccelerateConfig } from "../../value"
import type {
    AnimationPlaybackControlsWithThen,
    TimelineWithFallback,
} from "../types"
import { notifyAnimationStart } from "../utils/notify-inspector"
import { supportsLinearEasing } from "../../utils/supports/linear-easing"
import { generateLinearEasing } from "./utils/linear"

/**
 * Play a style of an element with a WAAPI animation that the config's
 * factory links to a timeline. Set as the `bind` of an accelerate config,
 * so only the code that makes those configs carries it.
 */
export function bindAccelerate(
    element: HTMLElement,
    name: string,
    config: AccelerateConfig
): VoidFunction {
    const { factory, keyframes, times, ease, duration } = config

    /**
     * The factory links this to a scroll timeline, so it only needs
     * the part of the playback controls that linking calls.
     */
    const ms = secondsToMilliseconds(duration)
    /**
     * A config's easing is a function, a list of them or nothing, so
     * this doesn't need the map of every easing definition.
     */
    const toEasing = (easingFunction?: EasingFunction) =>
        easingFunction && supportsLinearEasing()
            ? generateLinearEasing(easingFunction, ms)
            : "ease-out"
    const perKeyframe = Array.isArray(ease)
    const easing = perKeyframe ? ease.map(toEasing) : toEasing(ease)
    const frames: PropertyIndexedKeyframes = {
        [name]: keyframes,
        offset: times,
    }
    if (perKeyframe) frames.easing = easing as string[]

    const waapi = animateStyle(element, frames, {
        duration: ms,
        easing: perKeyframe ? "linear" : (easing as string),
        fill: "both",
    })
    waapi.onfinish = () => {
        setStyle(element, name, keyframes[keyframes.length - 1])
        waapi.cancel()
    }

    const animation = {
        attachTimeline({ timeline, onAttach, observe }: TimelineWithFallback) {
            waapi.onfinish = null

            if (timeline && supportsScrollTimeline()) {
                waapi.timeline = timeline as any
                onAttach?.(waapi)
                return noop
            }

            return observe(animation)
        },
        pause: () => waapi.pause(),
        set time(newTime: number) {
            waapi.currentTime = secondsToMilliseconds(newTime)
        },
        iterationDuration: duration,
        cancel() {
            waapi.onfinish = null
            try {
                waapi.cancel()
            } catch (e) {}
        },
    } as unknown as AnimationPlaybackControlsWithThen

    notifyAnimationStart(animation, {
        element,
        name,
        keyframes,
        times,
        ease,
        duration: ms,
    })

    const cleanup = factory(animation)

    return () => {
        cleanup()
        animation.cancel()
    }
}
