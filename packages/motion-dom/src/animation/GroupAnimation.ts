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
        this.animations = animations.filter(Boolean) as GroupedAnimations
    }

    get finished() {
        return Promise.all(
            this.animations.map((animation) => animation.finished)
        )
    }

    private getAll(propName: PropNames) {
        const activeAnimation = this.animations.find((animation) => {
            return animation.state !== "idle" && animation.state !== "finished"
        })

        return (activeAnimation || this.animations[0])[propName] as any
    }

    private setAll(propName: PropNames, newValue: any) {
        for (let i = 0; i < this.animations.length; i++) {
            ;(this.animations[i][propName] as any) = newValue
        }
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

    set time(time: number) {
        this.setAll("time", time)
    }

    get speed() {
        return this.getAll("speed")
    }

    set speed(speed: number) {
        this.setAll("speed", speed)
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

    private runAll(
        methodName: keyof Omit<
            AnimationPlaybackControls,
            PropNames | "then" | "finished" | "iterationDuration"
        >
    ) {
        this.animations.forEach((controls) => controls[methodName]())
    }

    play() {
        this.runAll("play")
    }

    pause() {
        this.runAll("pause")
    }

    // Bound to accomadate common `return animation.stop` pattern
    stop = () => this.runAll("stop")

    cancel() {
        this.runAll("cancel")
    }

    complete() {
        this.runAll("complete")
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
