import { AnimationPlaybackControls, ProgressTimeline } from "./types"

/**
 * NativeAnimation implements AnimationPlaybackControls for the browser's Web Animations API.
 */
export class NativeAnimation implements AnimationPlaybackControls {
    /**
     * The underlying Web Animation API animation
     */
    animation?: Animation

    /**
     * The current time of the animation, in seconds.
     */
    get time(): number {
        if (this.animation) {
            return ((this.animation.currentTime as number) || 0) / 1000
        }
        return 0
    }

    set time(newTime: number) {
        if (this.animation) {
            this.animation.currentTime = newTime * 1000
        }
    }

    /**
     * The playback speed of the animation.
     * 1 = normal speed, 2 = double speed, 0.5 = half speed.
     */
    get speed(): number {
        return this.animation ? this.animation.playbackRate : 1
    }

    set speed(newSpeed: number) {
        if (this.animation) {
            this.animation.playbackRate = newSpeed
        }
    }

    /**
     * The start time of the animation, in milliseconds.
     */
    get startTime(): number | null {
        return this.animation ? (this.animation.startTime as number) : null
    }

    /**
     * The state of the animation.
     */
    get state(): "idle" | "running" | "paused" | "finished" | undefined {
        return this.animation ? this.animation.playState : "finished"
    }

    /**
     * Duration of the animation, in seconds.
     */
    get duration(): number {
        const durationInMs =
            this.animation?.effect?.getComputedTiming().duration || 300

        return Number(durationInMs) / 1000
    }

    /**
     * Promise that resolves when the animation is finished
     */
    get finished(): Promise<any> {
        return this.animation ? this.animation.finished : Promise.resolve()
    }

    /**
     * Stops the animation at its current state, and prevents it from
     * resuming when the animation is played again.
     */
    stop(): void {
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

    /**
     * Plays the animation.
     */
    play(): void {
        this.animation && this.animation.play()
    }

    /**
     * Pauses the animation.
     */
    pause(): void {
        this.animation && this.animation.pause()
    }

    /**
     * Completes the animation and applies the final state.
     */
    complete(): void {
        this.animation && this.animation.finish()
    }

    /**
     * Cancels the animation and applies the initial state.
     */
    cancel(): void {
        try {
            this.animation && this.animation.cancel()
        } catch (e) {}
    }

    /**
     * Allows the animation to be awaited.
     */
    then(onResolve: VoidFunction, onReject?: VoidFunction): Promise<void> {
        return this.finished.then(onResolve).catch(onReject)
    }

    /**
     * Attaches a timeline to the animation, for instance the `ScrollTimeline`.
     */
    attachTimeline(
        timeline: ProgressTimeline,
        fallback?: (animation: AnimationPlaybackControls) => VoidFunction
    ): VoidFunction {
        // Stub implementation
        return () => {}
    }

    /**
     * Flattens the animation's easing curve to linear.
     */
    flatten(): void {
        if (!this.animation) return

        this.animation.effect?.updateTiming({ easing: "linear" })
    }
}
