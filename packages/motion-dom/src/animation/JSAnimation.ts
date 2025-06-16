import {
    clamp,
    invariant,
    millisecondsToSeconds,
    pipe,
    secondsToMilliseconds,
} from "motion-utils"
import { time } from "../frameloop/sync-time"
import { activeAnimations } from "../stats/animation-count"
import { mix } from "../utils/mix"
import { Mixer } from "../utils/mix/types"
import { frameloopDriver } from "./drivers/frame"
import { DriverControls } from "./drivers/types"
import { inertia } from "./generators/inertia"
import { keyframes as keyframesGenerator } from "./generators/keyframes"
import { calcGeneratorDuration } from "./generators/utils/calc-duration"
import { getFinalKeyframe } from "./keyframes/get-final"
import {
    AnimationPlaybackControlsWithThen,
    AnimationState,
    GeneratorFactory,
    KeyframeGenerator,
    TimelineWithFallback,
    ValueAnimationOptions,
} from "./types"
import { replaceTransitionType } from "./utils/replace-transition-type"
import { WithPromise } from "./utils/WithPromise"

const percentToProgress = (percent: number) => percent / 100

export class JSAnimation<T extends number | string>
    extends WithPromise
    implements AnimationPlaybackControlsWithThen
{
    state: AnimationPlayState = "idle"

    startTime: number | null = null

    /**
     * The driver that's controlling the animation loop. Normally this is a requestAnimationFrame loop
     * but in tests we can pass in a synchronous loop.
     */
    private driver?: DriverControls

    private isStopped = false

    private generator: KeyframeGenerator<T>

    private calculatedDuration: number

    private resolvedDuration: number

    private totalDuration: number

    private options: ValueAnimationOptions<T>

    /**
     * The current time of the animation.
     */
    private currentTime: number = 0

    /**
     * The time at which the animation was paused.
     */
    private holdTime: number | null = null

    /**
     * Playback speed as a factor. 0 would be stopped, -1 reverse and 2 double speed.
     */
    private playbackSpeed = 1

    /*
     * If our generator doesn't support mixing numbers, we need to replace keyframes with
     * [0, 100] and then make a function that maps that to the actual keyframes.
     *
     * 100 is chosen instead of 1 as it works nicer with spring animations.
     */
    private mixKeyframes: Mixer<T> | undefined

    private mirroredGenerator: KeyframeGenerator<T> | undefined

    constructor(options: ValueAnimationOptions<T>) {
        super()
        activeAnimations.mainThread++

        this.options = options
        this.initAnimation()
        this.play()

        if (options.autoplay === false) this.pause()
    }

    initAnimation() {
        const { options } = this

        replaceTransitionType(options)

        const {
            type = keyframesGenerator,
            repeat = 0,
            repeatDelay = 0,
            repeatType,
            velocity = 0,
        } = options
        let { keyframes } = options

        const generatorFactory =
            (type as GeneratorFactory) || keyframesGenerator

        if (
            process.env.NODE_ENV !== "production" &&
            generatorFactory !== keyframesGenerator
        ) {
            invariant(
                keyframes.length <= 2,
                `Only two keyframes currently supported with spring and inertia animations. Trying to animate ${keyframes}`
            )
        }

        if (
            generatorFactory !== keyframesGenerator &&
            typeof keyframes[0] !== "number"
        ) {
            this.mixKeyframes = pipe(
                percentToProgress,
                mix(keyframes[0], keyframes[1])
            ) as (t: number) => T

            keyframes = [0 as T, 100 as T]
        }

        const generator = generatorFactory({ ...options, keyframes })

        /**
         * If we have a mirror repeat type we need to create a second generator that outputs the
         * mirrored (not reversed) animation and later ping pong between the two generators.
         */
        if (repeatType === "mirror") {
            this.mirroredGenerator = generatorFactory({
                ...options,
                keyframes: [...keyframes].reverse(),
                velocity: -velocity,
            })
        }

        /**
         * If duration is undefined and we have repeat options,
         * we need to calculate a duration from the generator.
         *
         * We set it to the generator itself to cache the duration.
         * Any timeline resolver will need to have already precalculated
         * the duration by this step.
         */
        if (generator.calculatedDuration === null) {
            generator.calculatedDuration = calcGeneratorDuration(generator)
        }

        const { calculatedDuration } = generator
        this.calculatedDuration = calculatedDuration
        this.resolvedDuration = calculatedDuration + repeatDelay
        this.totalDuration = this.resolvedDuration * (repeat + 1) - repeatDelay
        this.generator = generator
    }

    updateTime(timestamp: number) {
        const animationTime =
            Math.round(timestamp - this.startTime!) * this.playbackSpeed

        // Update currentTime
        if (this.holdTime !== null) {
            this.currentTime = this.holdTime
        } else {
            // Rounding the time because floating point arithmetic is not always accurate, e.g. 3000.367 - 1000.367 =
            // 2000.0000000000002. This is a problem when we are comparing the currentTime with the duration, for
            // example.
            this.currentTime = animationTime
        }
    }

    tick(timestamp: number, sample = false) {
        const {
            generator,
            totalDuration,
            mixKeyframes,
            mirroredGenerator,
            resolvedDuration,
            calculatedDuration,
        } = this

        if (this.startTime === null) return generator.next(0)

        const {
            delay = 0,
            keyframes,
            repeat,
            repeatType,
            repeatDelay,
            type,
            onUpdate,
            finalKeyframe,
        } = this.options

        /**
         * requestAnimationFrame timestamps can come through as lower than
         * the startTime as set by performance.now(). Here we prevent this,
         * though in the future it could be possible to make setting startTime
         * a pending operation that gets resolved here.
         */
        if (this.speed > 0) {
            this.startTime = Math.min(this.startTime, timestamp)
        } else if (this.speed < 0) {
            this.startTime = Math.min(
                timestamp - totalDuration / this.speed,
                this.startTime
            )
        }

        if (sample) {
            this.currentTime = timestamp
        } else {
            this.updateTime(timestamp)
        }

        // Rebase on delay
        const timeWithoutDelay =
            this.currentTime - delay * (this.playbackSpeed >= 0 ? 1 : -1)
        const isInDelayPhase =
            this.playbackSpeed >= 0
                ? timeWithoutDelay < 0
                : timeWithoutDelay > totalDuration
        this.currentTime = Math.max(timeWithoutDelay, 0)

        // If this animation has finished, set the current time  to the total duration.
        if (this.state === "finished" && this.holdTime === null) {
            this.currentTime = totalDuration
        }

        let elapsed = this.currentTime
        let frameGenerator = generator

        if (repeat) {
            /**
             * Get the current progress (0-1) of the animation. If t is >
             * than duration we'll get values like 2.5 (midway through the
             * third iteration)
             */
            const progress =
                Math.min(this.currentTime, totalDuration) / resolvedDuration

            /**
             * Get the current iteration (0 indexed). For instance the floor of
             * 2.5 is 2.
             */
            let currentIteration = Math.floor(progress)

            /**
             * Get the current progress of the iteration by taking the remainder
             * so 2.5 is 0.5 through iteration 2
             */
            let iterationProgress = progress % 1.0

            /**
             * If iteration progress is 1 we count that as the end
             * of the previous iteration.
             */
            if (!iterationProgress && progress >= 1) {
                iterationProgress = 1
            }

            iterationProgress === 1 && currentIteration--

            currentIteration = Math.min(currentIteration, repeat + 1)

            /**
             * Reverse progress if we're not running in "normal" direction
             */

            const isOddIteration = Boolean(currentIteration % 2)
            if (isOddIteration) {
                if (repeatType === "reverse") {
                    iterationProgress = 1 - iterationProgress
                    if (repeatDelay) {
                        iterationProgress -= repeatDelay / resolvedDuration
                    }
                } else if (repeatType === "mirror") {
                    frameGenerator = mirroredGenerator!
                }
            }

            elapsed = clamp(0, 1, iterationProgress) * resolvedDuration
        }

        /**
         * If we're in negative time, set state as the initial keyframe.
         * This prevents delay: x, duration: 0 animations from finishing
         * instantly.
         */
        const state = isInDelayPhase
            ? { done: false, value: keyframes[0] }
            : frameGenerator.next(elapsed)

        if (mixKeyframes) {
            state.value = mixKeyframes(state.value as number)
        }

        let { done } = state

        if (!isInDelayPhase && calculatedDuration !== null) {
            done =
                this.playbackSpeed >= 0
                    ? this.currentTime >= totalDuration
                    : this.currentTime <= 0
        }

        const isAnimationFinished =
            this.holdTime === null &&
            (this.state === "finished" || (this.state === "running" && done))

        // TODO: The exception for inertia could be cleaner here
        if (isAnimationFinished && type !== inertia) {
            state.value = getFinalKeyframe(
                keyframes,
                this.options,
                finalKeyframe,
                this.speed
            )
        }

        if (onUpdate) {
            onUpdate(state.value)
        }

        if (isAnimationFinished) {
            this.finish()
        }

        return state
    }

    /**
     * Allows the returned animation to be awaited or promise-chained. Currently
     * resolves when the animation finishes at all but in a future update could/should
     * reject if its cancels.
     */
    then(resolve: VoidFunction, reject?: VoidFunction) {
        return this.finished.then(resolve, reject)
    }

    get duration() {
        return millisecondsToSeconds(this.calculatedDuration)
    }

    get time() {
        return millisecondsToSeconds(this.currentTime)
    }

    set time(newTime: number) {
        newTime = secondsToMilliseconds(newTime)
        this.currentTime = newTime

        if (
            this.startTime === null ||
            this.holdTime !== null ||
            this.playbackSpeed === 0
        ) {
            this.holdTime = newTime
        } else if (this.driver) {
            this.startTime = this.driver.now() - newTime / this.playbackSpeed
        }

        this.driver?.start(false)
    }

    get speed() {
        return this.playbackSpeed
    }

    set speed(newSpeed: number) {
        this.updateTime(time.now())
        const hasChanged = this.playbackSpeed !== newSpeed
        this.playbackSpeed = newSpeed

        if (hasChanged) {
            this.time = millisecondsToSeconds(this.currentTime)
        }
    }

    play() {
        if (this.isStopped) return

        const { driver = frameloopDriver, startTime } = this.options

        if (!this.driver) {
            this.driver = driver((timestamp) => this.tick(timestamp))
        }

        this.options.onPlay?.()

        const now = this.driver.now()

        if (this.state === "finished") {
            this.updateFinished()
            this.startTime = now
        } else if (this.holdTime !== null) {
            this.startTime = now - this.holdTime
        } else if (!this.startTime) {
            this.startTime = startTime ?? now
        }

        if (this.state === "finished" && this.speed < 0) {
            this.startTime += this.calculatedDuration
        }

        this.holdTime = null

        /**
         * Set playState to running only after we've used it in
         * the previous logic.
         */
        this.state = "running"

        this.driver.start()
    }

    pause() {
        this.state = "paused"
        this.updateTime(time.now())
        this.holdTime = this.currentTime
    }

    /**
     * This method is bound to the instance to fix a pattern where
     * animation.stop is returned as a reference from a useEffect.
     */
    stop = () => {
        
        const { motionValue } = this.options
        if (motionValue && motionValue.updatedAt !== time.now()) {
            this.tick(time.now())
        }

        this.isStopped = true
        if (this.state === "idle") return
        this.teardown()
        this.options.onStop?.()
    }

    complete() {
        if (this.state !== "running") {
            this.play()
        }

        this.state = "finished"
        this.holdTime = null
    }

    finish() {
        this.notifyFinished()
        this.teardown()
        this.state = "finished"

        this.options.onComplete?.()
    }

    cancel() {
        this.holdTime = null
        this.startTime = 0
        this.tick(0)
        this.teardown()
        this.options.onCancel?.()
    }

    private teardown() {
        this.state = "idle"
        this.stopDriver()
        this.startTime = this.holdTime = null
        activeAnimations.mainThread--
    }

    private stopDriver() {
        if (!this.driver) return
        this.driver.stop()
        this.driver = undefined
    }

    sample(sampleTime: number): AnimationState<T> {
        this.startTime = 0
        return this.tick(sampleTime, true)
    }

    attachTimeline(timeline: TimelineWithFallback): VoidFunction {
        if (this.options.allowFlatten) {
            this.options.type = "keyframes"
            this.options.ease = "linear"
            this.initAnimation()
        }

        this.driver?.stop()
        return timeline.observe(this)
    }
}

// Legacy function support
export function animateValue<T extends number | string>(
    options: ValueAnimationOptions<T>
) {
    return new JSAnimation(options)
}
