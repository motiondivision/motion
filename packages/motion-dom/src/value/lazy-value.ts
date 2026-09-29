import { collectMotionValues, MotionValue, MotionValueEventCallbacks } from "."
import { cancelFrame, frame } from "../frameloop"

export interface MotionValueSource {
    /**
     * Starts keeping the value up to date, and returns a function that stops.
     */
    subscribe: () => VoidFunction
    /**
     * Brings the value up to date if it isn't kept so. Returns whether it's
     * kept up to date anyway.
     */
    refresh: () => unknown
}

/**
 * A lazy `MotionValue` is only kept up to date by its source while it's
 * observed: while it has a `change` subscriber, or its velocity has been read.
 * Otherwise, it's refreshed from its source when it's read.
 */
export class LazyMotionValue<
    V = any,
    S extends MotionValueSource = MotionValueSource
> extends MotionValue<V> {
    private stopSource?: VoidFunction
    private tracksVelocity?: boolean

    constructor(init: V, readonly source: S) {
        super(init)
    }

    on<EventName extends keyof MotionValueEventCallbacks<V>>(
        eventName: EventName,
        callback: MotionValueEventCallbacks<V>[EventName]
    ): VoidFunction {
        // Catch up before subscribing, so the new subscriber isn't notified
        this.refresh()
        const unsubscribe = super.on(eventName, callback)
        if (eventName === "change") this.stopSource ||= this.source.subscribe()
        return unsubscribe
    }

    /**
     * Called a frame after the last `change` subscriber leaves.
     */
    stop() {
        super.stop()
        if (
            !this.tracksVelocity &&
            !this["changeSubscriber"] &&
            !this["events"].change?.getSize()
        ) {
            this.stopSource?.()
            this.stopSource = undefined
        }
    }

    get() {
        this.refresh()
        return super.get()
    }

    /**
     * Velocity is measured between frames, so reading it keeps the value up
     * to date from then on. Until then, there may not be frames to measure.
     */
    getVelocity() {
        if (!this.stopSource) {
            this.tracksVelocity = true
            const isCurrent = this.source.refresh()
            this.stopSource = this.source.subscribe()
            if (!isCurrent) return 0
        }
        return super.getVelocity()
    }

    destroy() {
        this.tracksVelocity = false
        super.destroy()
    }

    /**
     * The source's own reads aren't dependencies of a transform reading this.
     */
    private refresh() {
        const collecting = collectMotionValues.current
        collectMotionValues.current = undefined
        this.stopSource || this.source.refresh()
        collectMotionValues.current = collecting
    }
}

export interface DerivedSource<V> extends MotionValueSource {
    inputs: MotionValue[]
    compute: () => V
    unsubscribe: VoidFunction
    /**
     * Updates the value if it's kept up to date.
     */
    sync: VoidFunction
}

/**
 * Create a lazy `MotionValue` computed from `inputs`. It only subscribes to
 * them while it's observed, and is otherwise computed when it's read.
 */
export function derivedValue<V>(
    inputs: MotionValue[],
    compute: () => V,
    init = compute()
): LazyMotionValue<V, DerivedSource<V>> {
    let subscriptions: VoidFunction[] | undefined

    /**
     * Pre-bound so whenever an input updates it can schedule its execution
     * in Framesync. If it's already been scheduled it won't be fired twice
     * in a single frame.
     */
    const update = () => value.set(source.compute())

    const source: DerivedSource<V> = {
        inputs,
        compute,
        subscribe: () => {
            const scheduleUpdate = () => frame.preRender(update, false, true)
            subscriptions ||= source.inputs.map((v) =>
                v.on("change", scheduleUpdate)
            )
            return source.unsubscribe
        },
        unsubscribe: () => {
            subscriptions?.forEach((unsubscribe) => unsubscribe())
            subscriptions = undefined
            cancelFrame(update)
        },
        refresh: update,
        sync: () => subscriptions && update(),
    }

    const value = new LazyMotionValue(init, source)

    return value
}
