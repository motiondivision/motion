import { MotionGlobalConfig } from "motion-utils"
import { time } from "../frameloop/sync-time"
import { JSAnimation } from "./JSAnimation"
import { getFinalKeyframe } from "./keyframes/get-final"
import {
    KeyframeResolver as DefaultKeyframeResolver,
    flushKeyframeResolvers,
    ResolvedKeyframes,
} from "./keyframes/KeyframesResolver"
import { NativeAnimationExtended } from "./NativeAnimationExtended"
import { NativeTransformAnimation } from "./NativeTransformAnimation"
import {
    AnimationPlaybackControls,
    AnyResolvedKeyframe,
    TimelineWithFallback,
    ValueAnimationOptions,
} from "./types"
import { canAnimate } from "./utils/can-animate"
import { makeAnimationInstant } from "./utils/make-animation-instant"
import { resolveStartTime } from "./utils/resolve-start-time"
import { WithPromise } from "./utils/WithPromise"
import { supportsBrowserAnimation } from "./waapi/supports/waapi"
import { independentTransformProperty } from "../render/html/utils/independent-transforms"

type ResolvedOptions<T extends AnyResolvedKeyframe> =
    ValueAnimationOptions<T> & {
        startTime?: number
        finalKeyframe?: T
    }

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

        const { name, type, velocity, delay, isHandoff, onUpdate } = options
        this.resolvedAt = time.now()

        /**
         * If we can't animate this value with the resolved keyframes
         * then we should complete it immediately.
         */
        let canAnimateValue = true
        if (!canAnimate(keyframes, name, type, velocity)) {
            canAnimateValue = false

            if (MotionGlobalConfig.instantAnimations || !delay) {
                onUpdate?.(getFinalKeyframe(keyframes, options, finalKeyframe))
            }

            keyframes[0] = keyframes[keyframes.length - 1]

            makeAnimationInstant(options)
            options.repeat = 0
        }

        const { onComplete } = options
        options.finalKeyframe = finalKeyframe
        options.keyframes = keyframes
        /**
         * JSAnimation and NativeAnimation call onComplete exactly when
         * their own `finished` resolves, so this replaces a promise chain
         * per value with a callback.
         */
        options.onComplete = () => {
            onComplete?.()
            this.notifyFinished()
        }

        /**
         * Animate via WAAPI if possible. If this is a handoff animation, the optimised animation will be running via
         * WAAPI. Therefore, this animation must be JS to ensure it runs "under" the
         * optimised animation.
         *
         * Also skip WAAPI when keyframes aren't animatable, as the resolved
         * values may not be valid CSS and would trigger browser warnings.
         */
        const useWaapi =
            canAnimateValue && !isHandoff && supportsBrowserAnimation(options)

        /**
         * Resolve startTime for the animation. A startTime passed in options
         * (an optimised appear handoff syncing to its WAAPI animation) takes
         * precedence.
         *
         * *Ideally*, we would use the createdAt time as t=0 as the following
         * frame would then be the first frame of the animation in progress,
         * which would feel snappier. If keyframes resolved on a later frame,
         * and long after creation, we start from then instead.
         *
         * If they resolved immediately, a JSAnimation picks its own start
         * time and resolves it the same way on its first frame, so every
         * animation started in that moment stays in sync. WAAPI has no frame
         * of ours to do that on.
         */
        if (sync && (useWaapi || this.resolvedAt !== this.createdAt)) {
            options.startTime ??= resolveStartTime(
                this.createdAt,
                this.resolvedAt!
            )
        }

        let animation: AnimationPlaybackControls
        if (useWaapi) {
            /**
             * The resolver needed the VisualElement, WAAPI needs the DOM
             * element. JSAnimation reads neither, so this is safe to
             * leave in place if we fall back to it.
             */
            options.element = options.motionValue?.owner?.current
            try {
                animation = independentTransformProperty[name!]
                    ? new NativeTransformAnimation(
                          options as any,
                          /**
                           * If the transform property can no longer be
                           * accelerated, the animation continues on the
                           * main thread and replaces itself here.
                           */
                          (next) => (this._animation = next)
                      )
                    : new NativeAnimationExtended(options as any)
            } catch {
                animation = new JSAnimation(options)
            }
        } else {
            animation = new JSAnimation(options)
        }

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
