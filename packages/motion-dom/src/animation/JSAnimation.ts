import { time } from "../frameloop/sync-time"
import type { MotionValue } from "../value"
import { calcGeneratorVelocity } from "./generators/utils/velocity"
import { MultiValueAnimation, ValueTrack } from "./MultiValueAnimation"
import { generateTrack } from "./track"
import { supportTimelines } from "./animate/attach-timeline"
import {
    AnimationState,
    TimelineWithFallback,
    ValueAnimationOptions,
} from "./types"

/**
 * One value, animated from options that are already resolved, on an
 * animation of its own. It's a MultiValueAnimation of one value, which
 * is given to `onUpdate` rather than set on a motion value.
 */
export class JSAnimation<
    T extends number | string
> extends MultiValueAnimation {
    private track: ValueTrack<T>

    /**
     * Stands in for the motion value a track sets, and keeps the latest
     * value. It's marked as updated so the track isn't caught up when
     * stopped, which is done here.
     */
    private output = {
        latest: undefined as unknown as T,
        updatedAt: 0,
        set(latest: T) {
            this.latest = latest
        },
    }

    /**
     * The time in ms being sampled, which then is the clock's time.
     */
    private sampled?: number

    constructor(options: ValueAnimationOptions<T>) {
        super(options.driver)

        const { autoplay, startTime, onUpdate } = options
        Object.assign(this.options, { autoplay, startTime })

        const track = (this.track = this.add(
            options,
            this.output as unknown as MotionValue<T>,
            { transition: { onUpdate }, base: options } as any,
            () => {}
        ))
        track.init()
        this.start()
    }

    /**
     * An inspector is given this animation, not its track.
     */
    onTrackReady(track: ValueTrack) {
        super.onTrackReady(track, this)
    }

    updateTime(timestamp: number) {
        this.sampled === undefined
            ? super.updateTime(timestamp)
            : (this.currentTime = this.sampled)
    }

    /**
     * The latest value, and whether its generator is done there.
     */
    tick(timestamp: number): AnimationState<T> {
        const { track, output } = this
        if (this.startTime === null) return track.generator.next(0)

        super.tick(timestamp)

        return {
            value: output.latest,
            done:
                this.state === "finished" ||
                generateTrack(track, this.currentTime, false).done,
        }
    }

    finish() {
        super.finish()
        this.track.options.onComplete?.()
    }

    /**
     * Move to a time in ms, delay included, whatever the clock's time and
     * speed, and update the value.
     */
    sample(sampleTime: number): AnimationState<T> {
        this.startTime = 0
        this.sampled = sampleTime
        const state = this.tick(sampleTime)
        this.sampled = undefined
        return state
    }

    /**
     * Returns the generator's velocity at the current time in units/second.
     * Uses the analytical derivative when available (springs), avoiding
     * the MotionValue's frame-dependent velocity estimation.
     */
    getGeneratorVelocity(): number {
        return calcGeneratorVelocity(
            this.track.generator,
            this.currentTime,
            this.track.options.velocity
        )
    }

    attachTimeline(timeline: TimelineWithFallback) {
        supportTimelines()
        return super.attachTimeline(timeline)
    }

    protected stopAnimation() {
        const { motionValue } = this.track.options
        const now = (this.output.updatedAt = time.now())
        /**
         * Catch the value up to now, but measure its velocity from the
         * previous frame: marking it as updated now keeps the value's
         * previous-frame sample.
         */
        if (motionValue && motionValue.updatedAt !== now) {
            this.tick((motionValue.updatedAt = now))
        }
        super.stopAnimation()
    }
}

// Legacy function support
export function animateValue<T extends number | string>(
    options: ValueAnimationOptions<T>
) {
    return new JSAnimation(options)
}
