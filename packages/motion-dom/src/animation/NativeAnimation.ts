import {
    invariant,
    millisecondsToSeconds,
    noop,
    secondsToMilliseconds,
} from "motion-utils"
import { setStyle } from "../render/dom/style-set"
import { supportsScrollTimeline } from "../utils/supports/scroll-timeline"
import { getFinalKeyframe } from "./keyframes/get-final"
import {
    AnimationPlaybackControlsWithThen,
    DOMValueAnimationOptions,
    TimelineWithFallback,
} from "./types"
import { WithPromise } from "./utils/WithPromise"
import { startWaapiAnimation } from "./waapi/start-waapi-animation"
import { applyGeneratorOptions } from "./waapi/utils/apply-generator"

export interface NativeAnimationOptions<V extends string | number = number>
    extends DOMValueAnimationOptions<V> {
    pseudoElement?: string
    startTime?: number
}

/**
 * NativeAnimation implements AnimationPlaybackControls for the browser's Web Animations API.
 */
export class NativeAnimation<T extends string | number>
    extends WithPromise
    implements AnimationPlaybackControlsWithThen
{
    /**
     * The interfaced Web Animation API animation
     */
    protected animation: Animation

    protected finishedTime: number | null = null

    protected options: NativeAnimationOptions

    private allowFlatten: boolean

    private isStopped = false

    private isPseudoElement: boolean

    constructor(options?: NativeAnimationOptions) {
        super()

        if (!options) return

        const {
            element,
            name,
            keyframes,
            pseudoElement,
            allowFlatten = false,
            finalKeyframe,
            onComplete,
        } = options as any

        this.isPseudoElement = Boolean(pseudoElement)

        this.allowFlatten = allowFlatten
        this.options = options

        invariant(
            typeof options.type !== "string",
            `animateMini doesn't support "type" as a string. Did you mean to import { spring } from "motion"?`
        )
        const transition = applyGeneratorOptions(options)

        this.animation = startWaapiAnimation(
            element,
            name,
            keyframes,
            transition,
            pseudoElement
        )

        if (transition.autoplay === false) {
            this.animation.pause()
        }

        this.animation.onfinish = () => {
            this.finishedTime = this.time

            if (!pseudoElement) {
                const keyframe = getFinalKeyframe(
                    keyframes as any,
                    this.options as any,
                    finalKeyframe,
                    this.speed
                )
                if (this.updateMotionValue) {
                    this.updateMotionValue(keyframe)
                } else {
                    /**
                     * If we can, we want to commit the final style as set by the user,
                     * rather than the computed keyframe value supplied by the animation.
                     */
                    setStyle(element, name, keyframe)
                }

                this.animation.cancel()
            }

            onComplete?.()
            this.notifyFinished()
        }
    }

    updateMotionValue?(value?: T): void

    play() {
        if (this.isStopped) return

        this.animation.play()

        if (this.state === "finished") {
            this.updateFinished()
        }
    }

    pause() {
        this.animation.pause()
    }

    complete() {
        this.animation.finish?.()
    }

    cancel() {
        try {
            this.animation.cancel()
        } catch (e) {}
    }

    stop() {
        if (this.isStopped) return
        this.isStopped = true
        const { state } = this

        if (state === "idle" || state === "finished") {
            return
        }

        if (this.updateMotionValue) {
            this.updateMotionValue()
        } else {
            this.commitStyles()
        }

        if (!this.isPseudoElement) this.cancel()
    }

    /**
     * WAAPI doesn't natively have any interruption capabilities.
     *
     * In this method, we commit styles back to the DOM before cancelling
     * the animation.
     *
     * This is designed to be overridden by NativeAnimationExtended, which
     * will create a renderless JS animation and sample it twice to calculate
     * its current value, "previous" value, and therefore allow
     * Motion to also correctly calculate velocity for any subsequent animation
     * while deferring the commit until the next animation frame.
     */
    protected commitStyles() {
        if (!this.isPseudoElement) {
            this.animation.commitStyles?.()
        }
    }

    get duration() {
        const duration =
            this.animation.effect?.getComputedTiming?.().duration || 0

        return millisecondsToSeconds(Number(duration))
    }

    get time() {
        return millisecondsToSeconds(Number(this.animation.currentTime) || 0)
    }

    set time(newTime: number) {
        this.finishedTime = null
        this.animation.currentTime = secondsToMilliseconds(newTime)
    }

    /**
     * The playback speed of the animation.
     * 1 = normal speed, 2 = double speed, 0.5 = half speed.
     */
    get speed() {
        return this.animation.playbackRate
    }

    set speed(newSpeed: number) {
        // Allow backwards playback after finishing
        if (newSpeed < 0) this.finishedTime = null

        this.animation.playbackRate = newSpeed
    }

    get state() {
        return this.finishedTime !== null
            ? "finished"
            : this.animation.playState
    }

    get startTime() {
        return Number(this.animation.startTime)
    }

    set startTime(newStartTime: number) {
        this.animation.startTime = newStartTime
    }

    /**
     * Attaches a timeline to the animation, for instance the `ScrollTimeline`.
     */
    attachTimeline({ timeline, observe }: TimelineWithFallback): VoidFunction {
        if (this.allowFlatten) {
            this.animation.effect?.updateTiming({ easing: "linear" })
        }

        this.animation.onfinish = null

        if (timeline && supportsScrollTimeline()) {
            this.animation.timeline = timeline as any

            return noop<void>
        } else {
            return observe(this)
        }
    }
}
