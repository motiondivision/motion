import { AnimationPlaybackControls, TimelineWithFallback } from "./types"

type PropNames =
    | "time"
    | "speed"
    | "duration"
    | "attachTimeline"
    | "startTime"
    | "state"

export type AcceptedAnimations = AnimationPlaybackControls

export type GroupedAnimations = AcceptedAnimations[]

export class GroupAnimation implements AnimationPlaybackControls {
    animations: GroupedAnimations

    constructor(animations: Array<AcceptedAnimations | undefined>) {
        /**
         * Values animated on one clip are grouped as the clip, so the
         * group controls it once rather than once per value.
         */
        const grouped = new Set<AcceptedAnimations>()
        for (const animation of animations) {
            animation &&
                grouped.add(
                    (animation as { grouped?: AcceptedAnimations }).grouped ||
                        animation
                )
        }
        this.animations = [...grouped]
    }

    get finished() {
        return Promise.all(
            this.animations.map((animation) => animation.finished)
        )
    }

    /**
     * TODO: Filter out cancelled or stopped animations before returning
     */
    private getAll(propName: PropNames) {
        return this.animations[0][propName] as any
    }

    attachTimeline(timeline: TimelineWithFallback) {
        const subscriptions = this.animations.map((animation) =>
            animation.attachTimeline(timeline)
        )

        return () => {
            subscriptions.forEach((cancel, i) => {
                cancel && cancel()
                this.animations[i].stop()
            })
        }
    }

    get time() {
        return this.getAll("time")
    }

    /**
     * Setters and methods name the property directly, rather than through
     * a shared helper, so each call site stays monomorphic. Sequences
     * call these on every animation, many times a second.
     */
    set time(time: number) {
        for (const animation of this.animations) animation.time = time
    }

    get speed() {
        return this.getAll("speed")
    }

    set speed(speed: number) {
        for (const animation of this.animations) animation.speed = speed
    }

    get state() {
        return this.getAll("state")
    }

    get startTime() {
        return this.getAll("startTime")
    }

    get duration() {
        return getMax(this.animations, "duration")
    }

    get iterationDuration() {
        return getMax(this.animations, "iterationDuration")
    }

    play() {
        for (const animation of this.animations) animation.play()
    }

    pause() {
        for (const animation of this.animations) animation.pause()
    }

    // Bound to accommodate common `return animation.stop` pattern
    stop = () => {
        for (const animation of this.animations) animation.stop()
    }

    cancel() {
        for (const animation of this.animations) animation.cancel()
    }

    complete() {
        for (const animation of this.animations) animation.complete()
    }
}

function getMax(
    animations: GroupedAnimations,
    propName: "iterationDuration" | "duration"
): number {
    let max = 0

    for (let i = 0; i < animations.length; i++) {
        const value = animations[i][propName]
        if (value !== null && value > max) {
            max = value
        }
    }
    return max
}
