import { MotionGlobalConfig, noop } from "motion-utils"
import { time } from "../frameloop/sync-time"
import { JSAnimation } from "./JSAnimation"
import { getFinalKeyframe } from "./keyframes/get-final"
import {
    KeyframeResolver as DefaultKeyframeResolver,
    flushKeyframeResolvers,
    ResolvedKeyframes,
} from "./keyframes/KeyframesResolver"
import { NativeAnimationExtended } from "./NativeAnimationExtended"
import {
    AnimationPlaybackControls,
    AnyResolvedKeyframe,
    TimelineWithFallback,
    ValueAnimationOptions,
} from "./types"
import { canAnimate } from "./utils/can-animate"
import { makeAnimationInstant } from "./utils/make-animation-instant"
import { WithPromise } from "./utils/WithPromise"
import { supportsBrowserAnimation } from "./waapi/supports/waapi"

/**
 * Maximum time allowed between an animation being created and it being
 * resolved for us to use the latter as the start time.
 *
 * This is to ensure that while we prefer to "start" an animation as soon
 * as it's triggered, we also want to avoid a visual jump if there's a big delay
 * between these two moments.
 */
const MAX_RESOLVE_DELAY = 40

type OptionsWithoutKeyframes<T extends AnyResolvedKeyframe> = Omit<
    ValueAnimationOptions<T>,
    "keyframes"
>

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

    constructor({
        autoplay = true,
        delay = 0,
        type = "keyframes",
        repeat = 0,
        repeatDelay = 0,
        repeatType = "loop",
        keyframes,
        name,
        motionValue,
        element,
        ...options
    }: ValueAnimationOptions<T>) {
        super()

        this.createdAt = time.now()

        const optionsWithDefaults: OptionsWithoutKeyframes<T> = {
            autoplay,
            delay,
            type,
            repeat,
            repeatDelay,
            repeatType,
            name,
            motionValue,
            element,
            ...options,
        }

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
        options: OptionsWithoutKeyframes<T>,
        sync: boolean
    ) {
        this.keyframeResolver = undefined

        const { name, type, velocity, delay, isHandoff, onUpdate } = options
        this.resolvedAt = time.now()

        /**
         * If we can't animate this value with the resolved keyframes
         * then we should complete it immediately.
         */
        if (!canAnimate(keyframes, name, type, velocity)) {
            if (MotionGlobalConfig.instantAnimations || !delay) {
                onUpdate?.(getFinalKeyframe(keyframes, options, finalKeyframe))
            }

            keyframes[0] = keyframes[keyframes.length - 1]

            makeAnimationInstant(options)
            options.repeat = 0
        }

        /**
         * Resolve startTime for the animation.
         *
         * This method uses the createdAt and resolvedAt to calculate the
         * animation startTime. *Ideally*, we would use the createdAt time as t=0
         * as the following frame would then be the first frame of the animation in
         * progress, which would feel snappier.
         *
         * However, if there's a delay (main thread work) between the creation of
         * the animation and the first commited frame, we prefer to use resolvedAt
         * to avoid a sudden jump into the animation.
         */
        const startTime = sync
            ? !this.resolvedAt
                ? this.createdAt
                : this.resolvedAt - this.createdAt > MAX_RESOLVE_DELAY
                ? this.resolvedAt
                : this.createdAt
            : undefined

        const resolvedOptions = {
            startTime,
            finalKeyframe,
            ...options,
            keyframes,
        }

        /**
         * Animate via WAAPI if possible. If this is a handoff animation, the optimised animation will be running via
         * WAAPI. Therefore, this animation must be JS to ensure it runs "under" the
         * optimised animation.
         */
        const animation =
            !isHandoff && supportsBrowserAnimation(resolvedOptions)
                ? new NativeAnimationExtended({
                      ...resolvedOptions,
                      element: resolvedOptions.motionValue!.owner!.current,
                  } as any)
                : new JSAnimation(resolvedOptions)

        animation.finished.then(() => this.notifyFinished()).catch(noop)

        if (this.pendingTimeline) {
            this.stopTimeline = animation.attachTimeline(this.pendingTimeline)
            this.pendingTimeline = undefined
        }

        this._animation = animation
    }

    get finished() {
        if (!this._animation) {
            return this._finished
        } else {
            return this.animation.finished
        }
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
