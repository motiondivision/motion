import {
    millisecondsToSeconds,
    noop,
    secondsToMilliseconds,
} from "motion-utils"
import {
    AnimationPlaybackControlsWithFinished,
    ValueAnimationOptions,
} from "../types"
import { attachTimeline } from "./utils/attach-timeline"

export class NativeAnimationControls
    implements Omit<AnimationPlaybackControlsWithFinished, "then">
{
    animation?: Animation

    options?: ValueAnimationOptions

    constructor(animation?: Animation) {
        this.animation = animation
    }

    get duration() {
        const durationInMs =
            this.animation?.effect?.getComputedTiming().duration ||
            this.options?.duration ||
            300

        return millisecondsToSeconds(Number(durationInMs))
    }

    get time() {
        if (this.animation) {
            return millisecondsToSeconds(
                (this.animation?.currentTime as number) || 0
            )
        }
        return 0
    }

    set time(newTime: number) {
        if (this.animation) {
            this.animation.currentTime = secondsToMilliseconds(newTime)
        }
    }

    get speed() {
        return this.animation ? this.animation.playbackRate : 1
    }

    set speed(newSpeed: number) {
        if (this.animation) {
            this.animation.playbackRate = newSpeed
        }
    }

    get state() {
        return this.animation ? this.animation.playState : "finished"
    }

    get startTime() {
        return this.animation ? (this.animation.startTime as number) : null
    }

    get finished() {
        return this.animation ? this.animation.finished : Promise.resolve()
    }

    play() {
        this.animation && this.animation.play()
    }

    pause() {
        this.animation && this.animation.pause()
    }

    stop() {
        if (
            !this.animation ||
            this.state === "idle" ||
            this.state === "finished"
        ) {
            return
        }

        if (this.animation.commitStyles) {
            this.animation.commitStyles()
        }
        this.cancel()
    }

    flatten() {
        if (!this.animation) return

        this.animation.effect?.updateTiming({ easing: "linear" })
    }

    attachTimeline(timeline: any) {
        if (this.animation) attachTimeline(this.animation, timeline)

        return noop<void>
    }

    complete() {
        this.animation && this.animation.finish()
    }

    cancel() {
        try {
            this.animation && this.animation.cancel()
        } catch (e) {}
    }
}
