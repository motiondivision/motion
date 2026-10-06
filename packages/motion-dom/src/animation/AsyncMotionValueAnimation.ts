import { time } from "../frameloop/sync-time"
import {
    KeyframeResolver as DefaultKeyframeResolver,
    flushKeyframeResolvers,
    ResolvedKeyframes,
} from "./keyframes/KeyframesResolver"
import {
    AnimationPlaybackControls,
    AnyResolvedKeyframe,
    TimelineWithFallback,
    ValueAnimationOptions,
} from "./types"
import {
    ResolvedOptions,
    startResolvedAnimation,
} from "./utils/start-resolved-animation"
import { WithPromise } from "./utils/WithPromise"

export class AsyncMotionValueAnimation<T extends AnyResolvedKeyframe>
    extends WithPromise
    implements AnimationPlaybackControls
{
    private createdAt: number

    private resolvedAt: number | undefined

    private _animation: AnimationPlaybackControls | undefined

    private pendingTimeline: TimelineWithFallback | undefined

    private keyframeResolver: DefaultKeyframeResolver | undefined

    private stopTimeline: VoidFunction | undefined

    constructor(options: ValueAnimationOptions<T>) {
        super()

        this.createdAt = time.now()

        const { keyframes, name, motionValue, element } = options

        /**
         * animateMotionValue builds a fresh options object per value, so
         * it's completed in place as keyframes resolve rather than copied.
         */
        const optionsWithDefaults = options as ResolvedOptions<T>
        optionsWithDefaults.autoplay ??= true
        optionsWithDefaults.delay ??= 0
        optionsWithDefaults.type ??= "keyframes"
        optionsWithDefaults.repeat ??= 0
        optionsWithDefaults.repeatDelay ??= 0
        optionsWithDefaults.repeatType ??= "loop"

        const KeyframeResolver =
            element?.KeyframeResolver || DefaultKeyframeResolver

        this.keyframeResolver = new KeyframeResolver(
            keyframes,
            (
                resolvedKeyframes: ResolvedKeyframes<T>,
                finalKeyframe: T,
                forced: boolean
            ) =>
                this.onKeyframesResolved(
                    resolvedKeyframes,
                    finalKeyframe,
                    optionsWithDefaults,
                    !forced
                ),
            name,
            motionValue,
            element
        )
        this.keyframeResolver?.scheduleResolve()
    }

    onKeyframesResolved(
        keyframes: ResolvedKeyframes<T>,
        finalKeyframe: T,
        options: ResolvedOptions<T>,
        sync: boolean
    ) {
        this.keyframeResolver = undefined
        this.resolvedAt = time.now()

        const { onComplete } = options
        /**
         * JSAnimation and NativeAnimation call onComplete exactly when
         * their own `finished` resolves, so this replaces a promise chain
         * per value with a callback.
         */
        options.onComplete = () => {
            onComplete?.()
            this.notifyFinished()
        }

        const animation = startResolvedAnimation(
            keyframes,
            finalKeyframe,
            options,
            sync,
            this.createdAt,
            this.resolvedAt
        )

        if (this.pendingTimeline) {
            this.stopTimeline = animation.attachTimeline(this.pendingTimeline)
            this.pendingTimeline = undefined
        }

        this._animation = animation
    }

    get finished() {
        return this._animation ? this._animation.finished : super.finished
    }

    then(onResolve: VoidFunction, _onReject?: VoidFunction) {
        return this.finished.finally(onResolve).then(() => {})
    }

    get animation(): AnimationPlaybackControls {
        if (!this._animation) {
            this.keyframeResolver?.resume()
            flushKeyframeResolvers()
        }

        return this._animation!
    }

    get duration() {
        return this.animation.duration
    }

    get iterationDuration() {
        return this.animation.iterationDuration
    }

    get time() {
        return this.animation.time
    }

    set time(newTime: number) {
        this.animation.time = newTime
    }

    get speed() {
        return this.animation.speed
    }

    get state() {
        return this.animation.state
    }

    set speed(newSpeed: number) {
        this.animation.speed = newSpeed
    }

    get startTime() {
        return this.animation.startTime
    }

    attachTimeline(timeline: TimelineWithFallback) {
        if (this._animation) {
            this.stopTimeline = this.animation.attachTimeline(timeline)
        } else {
            this.pendingTimeline = timeline
        }

        return () => this.stop()
    }

    play() {
        this.animation.play()
    }

    pause() {
        this.animation.pause()
    }

    complete() {
        this.animation.complete()
    }

    cancel() {
        if (this._animation) {
            this.animation.cancel()
        }

        this.keyframeResolver?.cancel()
    }

    /**
     * Bound to support return animation.stop pattern
     */
    stop = () => {
        if (this._animation) {
            this._animation.stop()
            this.stopTimeline?.()
        }

        this.keyframeResolver?.cancel()
    }
}
