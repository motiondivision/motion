import { AnimationPlaybackControls } from "./types"

export interface JSAnimationOptions {
    keyframes: ResolvedKeyframes<any>
}

export class JSAnimation implements AnimationPlaybackControls {
    constructor(options: JSAnimationOptions) {
        const generatorFactory = isGenerator(type)
            ? type
            : generators[type] || keyframesGeneratorFactory

        /*
         * If our generator doesn't support mixing numbers, we need to replace keyframes with
         * [0, 100] and then make a function that maps that to the actual keyframes.
         *
         * 100 is chosen instead of 1 as it works nicer with spring animations.
         */
        let mapPercentToKeyframes: ((v: number) => T) | undefined
        let mirroredGenerator: KeyframeGenerator<T> | undefined

        if (
            process.env.NODE_ENV !== "production" &&
            generatorFactory !== keyframesGeneratorFactory
        ) {
            invariant(
                keyframes.length <= 2,
                `Only two keyframes currently supported with spring and inertia animations. Trying to animate ${keyframes}`
            )
        }

        if (
            generatorFactory !== keyframesGeneratorFactory &&
            typeof keyframes[0] !== "number"
        ) {
            mapPercentToKeyframes = pipe(
                percentToProgress,
                mix(keyframes[0], keyframes[1])
            ) as (t: number) => T

            keyframes = [0 as T, 100 as T]
        }

        const generator = generatorFactory({ ...this.options, keyframes })

        /**
         * If we have a mirror repeat type we need to create a second generator that outputs the
         * mirrored (not reversed) animation and later ping pong between the two generators.
         */
        if (repeatType === "mirror") {
            mirroredGenerator = generatorFactory({
                ...this.options,
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
        const resolvedDuration = calculatedDuration + repeatDelay
        const totalDuration = resolvedDuration * (repeat + 1) - repeatDelay

        const { autoplay = true } = this.options

        activeAnimations.mainThread++

        this.play()

        if (this.pendingPlayState === "paused" || !autoplay) {
            this.pause()
        } else {
            this.state = this.pendingPlayState
        }
    }

    tick(timestamp: number, sample = false) {
        const { resolved } = this

        // If the animations has failed to resolve, return the final keyframe.
        if (!resolved) {
            const { keyframes } = this.options
            return { done: true, value: keyframes[keyframes.length - 1] }
        }

        const {
            finalKeyframe,
            generator,
            mirroredGenerator,
            mapPercentToKeyframes,
            keyframes,
            calculatedDuration,
            totalDuration,
            resolvedDuration,
        } = resolved

        if (this.startTime === null) return generator.next(0)

        const { delay, repeat, repeatType, repeatDelay, onUpdate } =
            this.options

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

        // Update currentTime
        if (sample) {
            this.currentTime = timestamp
        } else if (this.holdTime !== null) {
            this.currentTime = this.holdTime
        } else {
            // Rounding the time because floating point arithmetic is not always accurate, e.g. 3000.367 - 1000.367 =
            // 2000.0000000000002. This is a problem when we are comparing the currentTime with the duration, for
            // example.
            this.currentTime =
                Math.round(timestamp - this.startTime) * this.speed
        }

        // Rebase on delay
        const timeWithoutDelay =
            this.currentTime - delay * (this.speed >= 0 ? 1 : -1)
        const isInDelayPhase =
            this.speed >= 0
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

        if (mapPercentToKeyframes) {
            state.value = mapPercentToKeyframes(state.value as number)
        }

        let { done } = state

        if (!isInDelayPhase && calculatedDuration !== null) {
            done =
                this.speed >= 0
                    ? this.currentTime >= totalDuration
                    : this.currentTime <= 0
        }

        const isAnimationFinished =
            this.holdTime === null &&
            (this.state === "finished" || (this.state === "running" && done))

        if (isAnimationFinished && finalKeyframe !== undefined) {
            state.value = getFinalKeyframe(
                keyframes,
                this.options,
                finalKeyframe
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

    state: AnimationPlayState = "idle"

    /**
     * Allows the returned animation to be awaited or promise-chained. Currently
     * resolves when the animation finishes at all but in a future update could/should
     * reject if its cancels.
     */
    then(resolve: VoidFunction, reject?: VoidFunction) {
        return this.currentFinishedPromise.then(resolve, reject)
    }

    get duration() {
        const { resolved } = this
        return resolved ? millisecondsToSeconds(resolved.calculatedDuration) : 0
    }

    get time() {
        return millisecondsToSeconds(this.currentTime)
    }

    set time(newTime: number) {
        newTime = secondsToMilliseconds(newTime)
        this.currentTime = newTime

        if (this.holdTime !== null || this.speed === 0) {
            this.holdTime = newTime
        } else if (this.driver) {
            this.startTime = this.driver.now() - newTime / this.speed
        }
    }

    get speed() {
        return this.playbackSpeed
    }

    set speed(newSpeed: number) {
        const hasChanged = this.playbackSpeed !== newSpeed
        this.playbackSpeed = newSpeed
        if (hasChanged) {
            this.time = millisecondsToSeconds(this.currentTime)
        }
    }

    play() {
        if (!this.resolver.isScheduled) {
            this.resolver.resume()
        }

        if (!this._resolved) {
            this.pendingPlayState = "running"
            return
        }

        if (this.isStopped) return

        const { driver = frameloopDriver, onPlay, startTime } = this.options

        if (!this.driver) {
            this.driver = driver((timestamp) => this.tick(timestamp))
        }

        onPlay && onPlay()

        const now = this.driver.now()
        if (this.holdTime !== null) {
            this.startTime = now - this.holdTime
        } else if (!this.startTime) {
            this.startTime = startTime ?? this.calcStartTime()
        } else if (this.state === "finished") {
            this.startTime = now
        }

        if (this.state === "finished") {
            this.updateFinishedPromise()
        }

        this.cancelTime = this.startTime
        this.holdTime = null

        /**
         * Set playState to running only after we've used it in
         * the previous logic.
         */
        this.state = "running"

        this.driver.start()
    }

    pause() {
        if (!this._resolved) {
            this.pendingPlayState = "paused"
            return
        }

        this.state = "paused"
        this.holdTime = this.currentTime ?? 0
    }

    /**
     * This method is bound to the instance to fix a pattern where
     * animation.stop is returned as a reference from a useEffect.
     */
    stop = () => {
        this.resolver.cancel()
        this.isStopped = true
        if (this.state === "idle") return
        this.teardown()
        const { onStop } = this.options
        onStop && onStop()
    }

    complete() {
        if (this.state !== "running") {
            this.play()
        }

        this.pendingPlayState = this.state = "finished"
        this.holdTime = null
    }

    finish() {
        this.teardown()
        this.state = "finished"

        const { onComplete } = this.options
        onComplete && onComplete()
    }

    cancel() {
        if (this.cancelTime !== null) {
            this.tick(this.cancelTime)
        }
        this.teardown()
        this.updateFinishedPromise()
    }

    private teardown() {
        this.state = "idle"
        this.stopDriver()
        this.resolveFinishedPromise()
        this.updateFinishedPromise()
        this.startTime = this.cancelTime = null
        this.resolver.cancel()
        activeAnimations.mainThread--
    }

    private stopDriver() {
        if (!this.driver) return
        this.driver.stop()
        this.driver = undefined
    }

    sample(time: number): AnimationState<T> {
        this.startTime = 0
        return this.tick(time, true)
    }

    get finished() {
        return this.currentFinishedPromise
    }

    // flatten() {
    // if (!this.options.allowFlatten) return
    // this.options.type = "keyframes"
    // this.options.ease = "linear"
    //     Object.assign(
    //         this._resolved,
    //         this.initPlayback(this._resolved.keyframes)
    //     )
    // }
}

// Legacy interface
export function animateValue(
    options: ValueAnimationOptionsWithRenderContext<any>
): MainThreadAnimation<any> {
    return new MainThreadAnimation(options)
}
