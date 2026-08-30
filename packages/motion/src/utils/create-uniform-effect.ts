import { cancelFrame, frame, type MotionValue } from "framer-motion/dom"

export type UniformEffectValues<T extends object> = {
    [K in keyof T]?: MotionValue<T[K]>
}

interface UniformEffectSubscription {
    cancel: VoidFunction
}

class UniformEffectState<Subject extends object> {
    private pending: Record<string, unknown> = {}
    private subscriptions = new Map<string, UniformEffectSubscription>()

    constructor(
        private subject: Subject,
        private apply: (
            target: Subject,
            values: Record<string, unknown>
        ) => void
    ) {}

    private flush = () => {
        const pending = this.pending
        this.pending = {}
        this.apply(this.subject, pending)
    }

    set(key: string, value: MotionValue) {
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

export function createUniformEffect<Subject extends object>(
    apply: (subject: Subject, values: Record<string, unknown>) => void
) {
    const stateCache = new WeakMap<Subject, UniformEffectState<Subject>>()

    return (
        subject: Subject,
        values: Record<string, MotionValue | undefined>
    ): VoidFunction => {
        const state =
            stateCache.get(subject) ?? new UniformEffectState(subject, apply)
        stateCache.set(subject, state)

        const subscriptions: VoidFunction[] = []

        for (const key in values) {
            const value = values[key]
            value && subscriptions.push(state.set(key, value))
        }

        return () => {
            for (const cancel of subscriptions) cancel()
        }
    }
}
