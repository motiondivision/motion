import { AnimationPlaybackControls, ProgressTimeline } from "./types"

/**
 * JSAnimation implements AnimationPlaybackControls for JavaScript-based animations.
 */
export class JSAnimation implements AnimationPlaybackControls {
    /**
     * The current time of the animation, in seconds.
     */
    time: number = 0

    /**
     * The playback speed of the animation.
     * 1 = normal speed, 2 = double speed, 0.5 = half speed.
     */
    speed: number = 1

    /**
     * The start time of the animation, in milliseconds.
     */
    startTime: number | null = null

    /**
     * The state of the animation.
     */
    state?: "idle" | "running" | "paused" | "finished" = "idle"

    /**
     * Duration of the animation, in seconds.
     */
    duration: number = 0

    /**
     * Promise that resolves when the animation is finished
     */
    finished: Promise<any> = Promise.resolve()

    /**
     * Stops the animation at its current state, and prevents it from
     * resuming when the animation is played again.
     */
    stop(): void {
        // Stub implementation
    }

    /**
     * Plays the animation.
     */
    play(): void {
        // Stub implementation
    }

    /**
     * Pauses the animation.
     */
    pause(): void {
        // Stub implementation
    }

    /**
     * Completes the animation and applies the final state.
     */
    complete(): void {
        // Stub implementation
    }

    /**
     * Cancels the animation and applies the initial state.
     */
    cancel(): void {
        // Stub implementation
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
    attachTimeline?(
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
        // Stub implementation
    }
}
