import { frame } from "../frameloop"
import { SubscriptionManager } from "../utils/subscription-manager"
import { velocityPerSecond } from "../utils/velocity-per-second"
import { warnOnce } from "../utils/warn-once"
import { AnimationPlaybackControls, Transition } from "../animation/types"
import { time } from "../frameloop/sync-time"

export type Transformer<T> = (v: T) => T

/**
 * @public
 */
export type Subscriber<T> = (v: T) => void

/**
 * @public
 */
export type PassiveEffect<T> = (v: T, safeSetter: (v: T) => void) => void

export type StartAnimation = (
    complete: () => void
) => AnimationPlaybackControls | undefined

export interface MotionValueEventCallbacks<V> {
    animationStart: () => void
    animationComplete: () => void
    animationCancel: () => void
    change: (latestValue: V) => void
    renderRequest: () => void
}

/**
 * Maximum time between the value of two frames, beyond which we
 * assume the velocity has since been 0.
 */
const MAX_VELOCITY_DELTA = 30

const isFloat = (value: any): value is string => {
    return !isNaN(parseFloat(value))
}

interface ResolvedValues {
    [key: string]: string | number
}

export interface Owner {
    current: HTMLElement | unknown
    getProps: () => { onUpdate?: (latest: ResolvedValues) => void }
}

export interface MotionValueOptions {
    owner?: Owner
}

export const collectMotionValues: { current: MotionValue[] | undefined } = {
    current: undefined,
}

/**
 * `MotionValue` is used to track the state and velocity of motion values.
 *
 * @public
 */
export class MotionValue<V = any> {
    /**
     * This will be replaced by the build step with the latest version number.
     * When MotionValues are provided to motion components, warn if versions are mixed.
     */
    version = "__VERSION__"

    /**
     * If a MotionValue has an owner, it was created internally within Motion
     * and therefore has no external listeners. It is therefore safe to animate via WAAPI.
     */
    owner?: Owner

    /**
     * The current state of the `MotionValue`.
     */
    private current: V | undefined

    /**
     * The previous state of the `MotionValue`.
     */
    private prev: V | undefined

    /**
     * The previous state of the `MotionValue` at the end of the previous frame.
     */
    private prevFrameValue: V | undefined

    /**
     * The last time the `MotionValue` was updated.
     */
    updatedAt: number

    /**
     * The time `prevFrameValue` was updated.
     */
    prevUpdatedAt: number | undefined

    /**
     * A transition that should be applied to the next animation.
     * This is used to handle the `out` transition option.
     */
    nextTransition?: Transition

    /**
     * Add a passive effect to this `MotionValue`.
     *
     * A passive effect intercepts calls to `set`. For instance, `useSpring` adds
     * a passive effect that attaches a `spring` to the latest
     * set value. Hypothetically there could be a `useSmooth` that attaches an input smoothing effect.
     *
     * @internal
     */
    private passiveEffect?: PassiveEffect<V>
    private stopPassiveEffect?: VoidFunction

    /**
     * A reference to the currently-controlling animation.
     */
    animation?: AnimationPlaybackControls

    /**
     * Tracks whether this value can output a velocity. Currently this is only true
     * if the value is numerical, but we might be able to widen the scope here and support
     * other value types.
     *
     * @internal
     */
    private canTrackVelocity: boolean | null = null

    /**
     * Tracks whether this value should be removed
     * @internal
     */
    liveStyle?: boolean

    /**
     * @param init - The initiating value
     * @param config - Optional configuration options
     *
     * -  `transformer`: A function to transform incoming values with.
     *
     * @internal
     */
    constructor(init: V, options: MotionValueOptions = {}) {
        this.setCurrent(init)
        this.owner = options.owner
    }

    setCurrent(current: V) {
        this.current = current
        this.updatedAt = time.now()

        if (this.canTrackVelocity === null && current !== undefined) {
            this.canTrackVelocity = isFloat(this.current)
        }
    }

    setPrevFrameValue(prevFrameValue: V | undefined = this.current) {
        this.prevFrameValue = prevFrameValue
        this.prevUpdatedAt = this.updatedAt
    }

    /**
     * Adds a function that will be notified when the `MotionValue` is updated.
     *
     * It returns a function that, when called, will cancel the subscription.
     *
     * When calling `onChange` inside a React component, it should be wrapped with the
     * `useEffect` hook. As it returns an unsubscribe function, this should be returned
     * from the `useEffect` function to ensure you don't add duplicate subscribers..
     *
     * ```jsx
     * export const MyComponent = () => {
     *   const x = useMotionValue(0)
     *   const y = useMotionValue(0)
     *   const opacity = useMotionValue(1)
     *
     *   useEffect(() => {
     *     function updateOpacity() {
     *       const maxXY = Math.max(x.get(), y.get())
     *       const newOpacity = transform(maxXY, [0, 100], [1, 0])
     *       opacity.set(newOpacity)
     *     }
     *
     *     const unsubscribeX = x.on("change", updateOpacity)
     *     const unsubscribeY = y.on("change", updateOpacity)
     *
     *     return () => {
     *       unsubscribeX()
     *       unsubscribeY()
     *     }
     *   }, [])
     *
     *   return <motion.div style={{ x }} />
     * }
     * ```
     *
     * @param subscriber - A function that receives the latest value.
     * @returns A function that, when called, will cancel this subscription.
     *
     * @deprecated
     */
    onChange(subscription: Subscriber<V>): () => void {
        if (process.env.NODE_ENV !== "production") {
            warnOnce(
                false,
                `value.onChange(callback) is deprecated. Switch to value.on("change", callback).`
            )
        }
        return this.on("change", subscription)
    }

    /**
     * An object containing a SubscriptionManager for each active event.
     */
    private events: {
        [key: string]: SubscriptionManager<any>
    } = {}

    on<EventName extends keyof MotionValueEventCallbacks<V>>(
        eventName: EventName,
        callback: MotionValueEventCallbacks<V>[EventName]
    ) {
        if (!this.events[eventName]) {
            this.events[eventName] = new SubscriptionManager()
        }

        const unsubscribe = this.events[eventName].add(callback)

        if (eventName === "change") {
            return () => {
                unsubscribe()

                /**
                 * If we have no more change listeners by the start
                 * of the next frame, stop active animations.
                 */
                frame.read(() => {
                    if (!this.events.change.getSize()) {
                        this.stop()
                    }
                })
            }
        }

        return unsubscribe
    }

    clearListeners() {
        for (const eventManagers in this.events) {
            this.events[eventManagers].clear()
        }
    }

    /**
     * Attaches a passive effect to the `MotionValue`.
     *
     * @internal
     */
    attach(passiveEffect: PassiveEffect<V>, stopPassiveEffect: VoidFunction) {
        this.passiveEffect = passiveEffect
        this.stopPassiveEffect = stopPassiveEffect
    }

    /**
     * Sets the state of the `MotionValue`.
     *
     * @remarks
     *
     * ```jsx
     * const x = useMotionValue(0)
     * x.set(10)
     * ```
     *
     * @param latest - Latest value to set.
     * @param render - Whether to notify render subscribers. Defaults to `true`
     *
     * @public
     */
    set(v: V, render = true) {
        if (!render || !this.passiveEffect) {
            this.updateAndNotify(v, render)
        } else {
            this.passiveEffect(v, this.updateAndNotify)
        }
    }

    setWithVelocity(prev: V, current: V, delta: number) {
        this.set(current)
        this.prev = undefined
        this.prevFrameValue = prev
        this.prevUpdatedAt = this.updatedAt - delta
    }

    /**
     * Set the state of the `MotionValue`, stopping any active animations,
     * effects, and resets velocity to `0`.
     */
    jump(v: V, endAnimation = true) {
        this.updateAndNotify(v)
        this.prev = v
        this.prevUpdatedAt = this.prevFrameValue = undefined
        endAnimation && this.stop()
        if (this.stopPassiveEffect) this.stopPassiveEffect()
    }

    updateAndNotify = (v: V, render = true) => {
        const currentTime = time.now()

        /**
         * If we're updating the value during another frame or eventloop
         * than the previous frame, then the we set the previous frame value
         * to current.
         */
        if (this.updatedAt !== currentTime) {
            this.setPrevFrameValue()
        }

        this.prev = this.current

        this.setCurrent(v)

        // Update update subscribers
        if (this.current !== this.prev && this.events.change) {
            this.events.change.notify(this.current)
        }

        // Update render subscribers
        if (render && this.events.renderRequest) {
            this.events.renderRequest.notify(this.current)
        }
    }

    /**
     * Returns the latest state of `MotionValue`
     *
     * @returns - The latest state of `MotionValue`
     *
     * @public
     */
    get() {
        if (collectMotionValues.current) {
            collectMotionValues.current.push(this)
        }

        return this.current!
    }

    /**
     * @public
     */
    getPrevious() {
        return this.prev
    }

    /**
     * Returns the latest velocity of `MotionValue`
     *
     * @returns - The latest velocity of `MotionValue`. Returns `0` if the state is non-numerical.
     *
     * @public
     */
    getVelocity() {
        const currentTime = time.now()

        if (
            !this.canTrackVelocity ||
            this.prevFrameValue === undefined ||
            currentTime - this.updatedAt > MAX_VELOCITY_DELTA
        ) {
            return 0
        }

        const delta = Math.min(
            this.updatedAt - this.prevUpdatedAt!,
            MAX_VELOCITY_DELTA
        )

        // Casts because of parseFloat's poor typing
        return velocityPerSecond(
            parseFloat(this.current as any) -
                parseFloat(this.prevFrameValue as any),
            delta
        )
    }

    hasAnimated = false

    /**
     * Registers a new animation to control this `MotionValue`. Only one
     * animation can drive a `MotionValue` at one time.
     *
     * ```jsx
     * value.start()
     * ```
     *
     * @param animation - A function that starts the provided animation
     *
     * @internal
     */
    start(startAnimation: StartAnimation) {
        this.stop()

        return new Promise<void>((resolve) => {
            this.hasAnimated = true
            this.animation = startAnimation(resolve)

            if (this.events.animationStart) {
                this.events.animationStart.notify()
            }
        }).then(() => {
            if (this.events.animationComplete) {
                this.events.animationComplete.notify()
            }
            this.clearAnimation()
        })
    }

    /**
     * Stop the currently active animation.
     *
     * @public
     */
    stop() {
        if (this.animation) {
            this.animation.stop()
            if (this.events.animationCancel) {
                this.events.animationCancel.notify()
            }
        }
        this.clearAnimation()
    }

    /**
     * Returns `true` if this value is currently animating.
     *
     * @public
     */
    isAnimating() {
        return !!this.animation
    }

    private clearAnimation() {
        delete this.animation
    }

    /**
     * Destroy and clean up subscribers to this `MotionValue`.
     *
     * The `MotionValue` hooks like `useMotionValue` and `useTransform` automatically
     * handle the lifecycle of the returned `MotionValue`, so this method is only necessary if you've manually
     * created a `MotionValue` via the `motionValue` function.
     *
     * @public
     */
    destroy() {
        this.clearListeners()
        this.stop()

        if (this.stopPassiveEffect) {
            this.stopPassiveEffect()
        }
    }
}

export function motionValue<V>(init: V, options?: MotionValueOptions) {
    return new MotionValue<V>(init, options)
}
