import { millisecondsToSeconds, secondsToMilliseconds } from "motion-utils"
import { AnimationPlaybackControls, TimelineWithFallback } from "./types"

export interface SequenceCallback {
    time: number
    onEnter?: VoidFunction
    onLeave?: VoidFunction
}

/**
 * A lightweight "animation" that fires callbacks when time crosses specific points.
 * This implements just enough of AnimationPlaybackControls to work within a GroupAnimation.
 *
 * Overhead is minimal:
 * - No rendering or DOM operations
 * - Simple time comparison logic
 * - Only fires callbacks when time crosses thresholds
 */
export class SequenceCallbackAnimation implements AnimationPlaybackControls {
    state: AnimationPlayState = "running"
    startTime: number | null = null

    private callbacks: SequenceCallback[]
    private totalDuration: number
    private currentTime: number = 0
    private playbackSpeed: number = 1
    private resolveFinished!: VoidFunction
    private rejectFinished?: (reason?: unknown) => void

    finished: Promise<void>

    constructor(callbacks: SequenceCallback[], totalDuration: number) {
        // Callbacks should already be sorted by time
        this.callbacks = callbacks
        this.totalDuration = totalDuration

        this.finished = new Promise((resolve, reject) => {
            this.resolveFinished = resolve
            this.rejectFinished = reject
        })
    }

    get time(): number {
        return millisecondsToSeconds(this.currentTime)
    }

    set time(newTime: number) {
        const newTimeMs = secondsToMilliseconds(newTime)
        this.fireCallbacks(this.currentTime, newTimeMs)
        this.currentTime = newTimeMs
    }

    get speed(): number {
        return this.playbackSpeed
    }

    set speed(newSpeed: number) {
        this.playbackSpeed = newSpeed
    }

    get duration(): number {
        return millisecondsToSeconds(this.totalDuration)
    }

    get iterationDuration(): number {
        return this.duration
    }

    /**
     * Fire callbacks that we've crossed between prevTime and newTime.
     * Handles both forward and backward scrubbing.
     */
    private fireCallbacks(fromTime: number, toTime: number): void {
        if (fromTime === toTime || this.callbacks.length === 0) return

        const isForward = toTime > fromTime

        for (const callback of this.callbacks) {
            const callbackTimeMs = secondsToMilliseconds(callback.time)

            if (isForward) {
                // Moving forward: fire onEnter when we cross the callback time
                if (fromTime < callbackTimeMs && toTime >= callbackTimeMs) {
                    callback.onEnter?.()
                }
            } else {
                // Moving backward: fire onLeave when we cross the callback time
                if (fromTime >= callbackTimeMs && toTime < callbackTimeMs) {
                    callback.onLeave?.()
                }
            }
        }
    }

    play(): void {
        this.state = "running"
    }

    pause(): void {
        this.state = "paused"
    }

    stop(): void {
        this.state = "idle"
    }

    cancel(): void {
        this.state = "idle"
        this.rejectFinished?.()
    }

    complete(): void {
        // Fire any remaining callbacks before completion
        this.fireCallbacks(this.currentTime, this.totalDuration)
        this.currentTime = this.totalDuration
        this.state = "finished"
        this.resolveFinished()
    }

    /**
     * Attach to a timeline (e.g., scroll timeline).
     * Returns a cleanup function.
     */
    attachTimeline(timeline: TimelineWithFallback): VoidFunction {
        return timeline.observe(this as unknown as Parameters<typeof timeline.observe>[0])
    }
}
