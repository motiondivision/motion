import {
    animateSingleValue,
    cancelFrame,
    frame,
    GroupAnimationWithThen,
    invariant,
    motionValue,
    type AnimationOptions,
    type AnimationPlaybackControlsWithThen,
    type MotionValue,
} from "framer-motion/dom"

export type EffectValues<T extends object> = {
    [K in keyof T]?: MotionValue<T[K]>
}

export type EffectAnimationTarget<T extends object> = {
    [K in keyof T]?: T[K] extends string | number
        ? T[K] | Array<T[K] | null>
        : never
}

interface EffectSubscription {
    cancel: VoidFunction
    value: MotionValue
}

class EffectState<Subject extends object> {
    private pending: Record<string, unknown> = {}
    private subscriptions = new Map<string, EffectSubscription>()

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

        const subscription = {
            cancel: value.on("change", update),
            value,
        }
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

    get(key: string) {
        return this.subscriptions.get(key)?.value
    }
}

export interface EffectAdapter<Subject extends object> {
    effect(
        subject: Subject,
        values: Record<string, MotionValue | undefined>
    ): VoidFunction
    get(subject: Subject, key: string): MotionValue | undefined
    has(subject: Subject): boolean
}

export interface ResolvedEffect {
    adapter: EffectAdapter<any>
    initial: string | number
}

export type EffectResolver = (
    subject: object,
    key: string,
    target: unknown,
    adapter: EffectAdapter<any> | undefined
) => ResolvedEffect | undefined

export function createEffectAdapter<Subject extends object>(
    apply: (subject: Subject, values: Record<string, unknown>) => void
): EffectAdapter<Subject> {
    const stateCache = new WeakMap<Subject, EffectState<Subject>>()

    return {
        effect(subject, values) {
            const state =
                stateCache.get(subject) ?? new EffectState(subject, apply)
            stateCache.set(subject, state)

            const subscriptions: VoidFunction[] = []

            for (const key in values) {
                const value = values[key]
                value && subscriptions.push(state.set(key, value))
            }

            return () => {
                for (const cancel of subscriptions) cancel()
            }
        },
        get: (subject, key) => stateCache.get(subject)?.get(key),
        has: (subject) => stateCache.has(subject),
    }
}

export function createEffectAnimate(
    adapters: Array<EffectAdapter<any>>,
    type: string,
    resolve?: EffectResolver
) {
    return <T extends object>(
        subject: object,
        keyframes: EffectAnimationTarget<T>,
        options: AnimationOptions = {}
    ): AnimationPlaybackControlsWithThen => {
        let adapter = adapters.find((candidate) => candidate.has(subject))

        const { onComplete, ...transition } = options
        if (typeof transition.delay === "function") {
            transition.delay = transition.delay(0, 1)
        }

        const entries: Array<[string, MotionValue, any]> = []

        for (const key in keyframes) {
            const target = keyframes[key]
            let value = adapter?.get(subject, key)

            if (!value) {
                const resolved = resolve?.(subject, key, target, adapter)

                if (resolved) {
                    adapter = resolved.adapter
                    value = motionValue(resolved.initial)
                    adapter.effect(subject, { [key]: value })
                }
            }

            invariant(
                Boolean(value),
                `No MotionValue is registered for "${key}" on this ${type}.`
            )

            entries.push([key, value!, target])
        }

        const animations = entries.map(([key, value, target]) =>
            animateSingleValue(
                value,
                target,
                getTransition(transition, key)
            )
        )

        const animation = new GroupAnimationWithThen(animations)
        onComplete && animation.finished.then(onComplete)
        return animation
    }
}

function getTransition(options: AnimationOptions, key: string) {
    const valueOptions =
        (options as any)[key] ?? (options as any).default ?? options

    if (valueOptions !== options && valueOptions.inherit) {
        const rest = { ...valueOptions }
        delete rest.inherit
        return { ...options, ...rest }
    }

    return valueOptions
}
