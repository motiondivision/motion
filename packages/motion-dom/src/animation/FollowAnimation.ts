import { cancelFrame, frame } from "../frameloop"
import { time } from "../frameloop/sync-time"
import { FrameData } from "../frameloop/types"
import { DriverControls } from "./drivers/types"
import { keyframes as keyframesGenerator } from "./generators/keyframes"
import { calcGeneratorVelocity } from "./generators/utils/velocity"
import {
    GeneratorFactory,
    KeyframeGenerator,
    MotionValueAnimation,
    ValueAnimationOptions,
} from "./types"
import { replaceTransitionType } from "./utils/replace-transition-type"
import { WithPromise } from "./utils/WithPromise"

/**
 * Every running follower ticks from this one frame callback.
 */
const active = new Set<FollowAnimation>()

const tickAll = ({ timestamp }: FrameData) => {
    active.forEach((animation) => animation.tick(timestamp))
}

/**
 * A lean animation for values that follow a target (`followValue`,
 * `springValue`): a single numeric generator, retargeted in place as
 * the target moves and ticked from a frame callback shared by every
 * follower. Only implements the controls `MotionValue.animation`
 * exposes. Repeats aren't supported; `followValue` uses `JSAnimation`
 * for those.
 */
export class FollowAnimation
    extends WithPromise
    implements MotionValueAnimation
{
    state: AnimationPlayState = "idle"

    private generator: KeyframeGenerator<number>

    private factory: GeneratorFactory

    private options: ValueAnimationOptions<number>

    private startTime = 0

    private currentTime = 0

    /**
     * Whether the first tick has fired `onPlay`.
     */
    private started = false

    /**
     * A target set since the last tick, applied at the next one so any
     * number of sets per frame cost one retarget.
     */
    private hasNextTarget = false

    private nextTarget = 0

    private nextVelocity?: number

    /**
     * Only created when a custom driver is passed, otherwise the
     * follower ticks from the shared frame callback.
     */
    private driver?: DriverControls

    constructor(options: ValueAnimationOptions<number>) {
        super()

        this.options = options
        replaceTransitionType(options)
        this.factory = (options.type as GeneratorFactory) || keyframesGenerator
        this.generator = this.factory(options)

        const { driver } = options
        if (driver) this.driver = driver((timestamp) => this.tick(timestamp))

        this.startTime = this.now()
        this.state = "running"

        if (this.driver) {
            this.driver.start()
        } else {
            active.size || frame.update(tickAll, true)
            active.add(this)
        }
    }

    /**
     * Aim at a new target from wherever the animation has reached by the
     * next tick. `velocity` fixes the velocity to steer with, otherwise
     * the generator's is used.
     */
    setTarget(target: number, velocity?: number) {
        this.nextTarget = target
        this.nextVelocity = velocity
        this.hasNextTarget = true
    }

    /**
     * Steer towards new keyframes from the current position and velocity.
     * Springs are updated in place; other generators are recreated.
     */
    retarget(keyframes: number[], velocity: number) {
        const { options, generator } = this
        options.keyframes = keyframes
        options.velocity = velocity
        this.startTime = this.now()
        this.currentTime = 0

        if (generator.retarget) {
            generator.retarget(keyframes, velocity)
        } else {
            this.generator = this.factory(options)
        }
    }

    tick(timestamp: number) {
        const { options, hasNextTarget: retargeted } = this
        const { delay = 0, onUpdate, onPlay } = options
        const elapsed = Math.round(timestamp - this.startTime) - delay
        const t = (this.currentTime = Math.max(0, elapsed))
        const state = this.generator.next(t)
        // Hold the origin through the delay, even if the generator is already at rest
        const value = elapsed < 0 ? options.keyframes[0] : state.value

        if (retargeted) {
            /**
             * Steer from where the current trajectory has reached this
             * frame, then render that position as the new origin.
             */
            this.hasNextTarget = false
            const { keyframes } = options
            keyframes[0] = value
            keyframes[1] = this.nextTarget
            this.retarget(
                keyframes,
                this.nextVelocity ?? this.getGeneratorVelocity()
            )
        }

        if (retargeted || !this.started) {
            this.started = true
            onPlay?.()
        }

        /**
         * Callbacks may stop this animation or set a new target, so check
         * the live state rather than what was read at the top of the tick.
         */
        if (this.state !== "running") return

        onUpdate?.(value)

        if (
            state.done &&
            elapsed >= 0 &&
            !retargeted &&
            !this.hasNextTarget &&
            this.state === "running"
        ) {
            this.notifyFinished()
            this.teardown()
            this.state = "finished"
            options.onComplete?.()
        }
    }

    getGeneratorVelocity(): number {
        return calcGeneratorVelocity(
            this.generator,
            this.currentTime,
            this.options.velocity
        )
    }

    /**
     * Bound to the instance so `animation.stop` can be passed around.
     */
    stop = () => {
        if (this.state === "idle") return
        this.teardown()
        this.options.onStop?.()
    }

    private now() {
        return this.driver ? this.driver.now() : time.now()
    }

    private teardown() {
        this.state = "idle"

        if (this.driver) {
            this.driver.stop()
        } else {
            active.delete(this)
            active.size || cancelFrame(tickAll)
        }
    }
}
