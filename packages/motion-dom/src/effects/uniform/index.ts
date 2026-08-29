import { cancelFrame, frame } from "../../frameloop"
import { MotionValue } from "../../value"

export interface UniformEffectSubject<T extends object> {
    set(values: Partial<T>): unknown
}

export type UniformEffectValues<T extends object> = {
    [K in keyof T]?: MotionValue<T[K]>
}

interface UniformEffectSubscription {
    cancel: VoidFunction
}

class UniformEffectState<T extends object> {
    private pending: Partial<T> = {}
    private subscriptions = new Map<keyof T, UniformEffectSubscription>()

    constructor(private subject: UniformEffectSubject<T>) {}

    private flush = () => {
        const pending = this.pending
        this.pending = {}
        this.subject.set(pending)
    }

    set<K extends keyof T>(key: K, value: MotionValue<T[K]>) {
        this.subscriptions.get(key)?.cancel()

        const update = () => {
            this.pending[key] = value.get()
            frame.preRender(this.flush)
        }

        update()

        const subscription = { cancel: value.on("change", update) }
        this.subscriptions.set(key, subscription)

        return () => {
            subscription.cancel()

            if (this.subscriptions.get(key) !== subscription) return

            this.subscriptions.delete(key)
            delete this.pending[key]

            if (!Object.keys(this.pending).length) {
                cancelFrame(this.flush)
            }
        }
    }
}

const stateCache = new WeakMap<object, UniformEffectState<any>>()

/**
 * Binds MotionValues to GPU uniforms, batching changed values into one call
 * per frame.
 */
export function uniformEffect<T extends object>(
    subject: UniformEffectSubject<T>,
    values: UniformEffectValues<T>
): VoidFunction {
    const state = stateCache.get(subject) ?? new UniformEffectState(subject)
    stateCache.set(subject, state)

    const subscriptions: VoidFunction[] = []

    for (const name in values) {
        const key = name as keyof T
        const value = values[key]
        value && subscriptions.push(state.set(key, value))
    }

    return () => {
        for (const cancel of subscriptions) cancel()
    }
}
