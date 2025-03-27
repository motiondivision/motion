import { AnimationPlaybackControls, ProgressTimeline } from "./types"

/**
 * GroupAnimation implements AnimationPlaybackControls for a group of animations.
 */
export class GroupAnimation implements AnimationPlaybackControls {
    /**
     * Array of animations in this group
     */
    animations: AnimationPlaybackControls[] = []

    /**
     * The current time of the animation, in seconds.
     */
    get time(): number {
        return this.animations.length > 0 ? this.animations[0].time : 0
    }

    set time(newTime: number) {
        this.animations.forEach((animation) => {
            if ("time" in animation) {
                animation.time = newTime
            }
        })
    }

    /**
     * The playback speed of the animation.
     * 1 = normal speed, 2 = double speed, 0.5 = half speed.
     */
    get speed(): number {
        return this.animations.length > 0 ? this.animations[0].speed : 1
    }

    set speed(newSpeed: number) {
        this.animations.forEach((animation) => {
            if ("speed" in animation) {
                animation.speed = newSpeed
            }
        })
    }

    /**
     * The start time of the animation, in milliseconds.
     */
    get startTime(): number | null {
        return this.animations.length > 0 ? this.animations[0].startTime : null
    }

    /**
     * The state of the animation.
     */
    get state(): "idle" | "running" | "paused" | "finished" | undefined {
        return this.animations.length > 0 ? this.animations[0].state : "idle"
    }

    /**
     * Duration of the animation, in seconds.
     */
    get duration(): number {
        let max = 0
        for (let i = 0; i < this.animations.length; i++) {
            max = Math.max(max, this.animations[i].duration)
        }
        return max
    }

    /**
     * Promise that resolves when the animation is finished
     */
    get finished(): Promise<any> {
        return Promise.all(
            this.animations.map((animation) =>
                "finished" in animation ? animation.finished : animation
            )
        )
    }

    /**
     * Stops the animation at its current state, and prevents it from
     * resuming when the animation is played again.
     */
    stop(): void {
        this.animations.forEach((animation) => animation.stop())
    }

    /**
     * Plays the animation.
     */
    play(): void {
        this.animations.forEach((animation) => animation.play())
    }

    /**
     * Pauses the animation.
     */
    pause(): void {
        this.animations.forEach((animation) => animation.pause())
    }

    /**
     * Completes the animation and applies the final state.
     */
    complete(): void {
        this.animations.forEach((animation) => animation.complete())
    }

    /**
     * Cancels the animation and applies the initial state.
     */
    cancel(): void {
        this.animations.forEach((animation) => animation.cancel())
    }

    /**
     * Allows the animation to be awaited.
     */
    then(onResolve: VoidFunction, onReject?: VoidFunction): Promise<void> {
        return Promise.all(this.animations).then(onResolve).catch(onReject)
    }

    /**
     * Attaches a timeline to the animation, for instance the `ScrollTimeline`.
     */
    attachTimeline?(
        timeline: ProgressTimeline,
        fallback?: (animation: AnimationPlaybackControls) => VoidFunction
    ): VoidFunction {
        // Stub implementation for attaching timeline to all animations
        const detachers = this.animations
            .map(
                (animation) =>
                    animation.attachTimeline &&
                    animation.attachTimeline(timeline, fallback)
            )
            .filter(Boolean) as VoidFunction[]

        return () => detachers.forEach((detach) => detach())
    }

    /**
     * Flattens the animation's easing curve to linear.
     */
    flatten(): void {
        this.animations.forEach((animation) => animation.flatten())
    }
}
