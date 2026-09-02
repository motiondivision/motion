import {
    AnyResolvedKeyframe,
    UnresolvedValueKeyframe,
} from "../../animation/types"
import { Schedule } from "../../frameloop/types"
import { MotionValue } from "../../value"
import { MotionValueState } from "../MotionValueState"

/**
 * Returns true if the effect knows how to write to `subject`.
 */
export type EffectTest<Subject extends object> = (
    subject: unknown
) => subject is Subject

/**
 * Reads the current value of `key` from `subject`, used as the initial
 * keyframe when `animate()` creates a motion value for the subject.
 * Returns `undefined` when the value can't be read.
 *
 * `keyframes` is the target being animated to, so effects can match
 * the format of the initial value (for instance color vs numeric).
 */
export type EffectRead<Subject extends object> = (
    subject: Subject,
    key: string,
    keyframes?: UnresolvedValueKeyframe | UnresolvedValueKeyframe[]
) => AnyResolvedKeyframe | undefined

export interface EffectOptions<Subject extends object> {
    test?: EffectTest<Subject>
    read?: EffectRead<Subject>

    /**
     * Frameloop step writes are scheduled in. Defaults to `frame.render`.
     */
    step?: Schedule
}

export interface Effect<Subject extends object = object>
    extends EffectOptions<Subject> {
    (subject: Subject, values: Record<string, MotionValue>): VoidFunction

    /**
     * Returns the motion value currently bound to `key` on `subject`, if any.
     */
    get(subject: Subject, key: string): MotionValue | undefined
}

/**
 * An effect that can be registered with `animate.addEffect()`.
 */
export interface AnimateEffect<Subject extends object = object>
    extends Effect<Subject> {
    test: EffectTest<Subject>
    read: EffectRead<Subject>
}

export type AddEffectValue<Subject extends object> = (
    subject: Subject,
    state: MotionValueState,
    key: string,
    value: MotionValue
) => VoidFunction

export function createEffect<Subject extends object>(
    addValue: AddEffectValue<Subject>,
    options: EffectOptions<Subject> & {
        test: EffectTest<Subject>
        read: EffectRead<Subject>
    }
): AnimateEffect<Subject>
export function createEffect<Subject extends object>(
    addValue: AddEffectValue<Subject>,
    options?: EffectOptions<Subject>
): Effect<Subject>
export function createEffect<Subject extends object>(
    addValue: AddEffectValue<Subject>,
    { step, ...options }: EffectOptions<Subject> = {}
): Effect<Subject> {
    const stateCache = new WeakMap<Subject, MotionValueState>()

    const effect = (
        subject: Subject,
        values: Record<string, MotionValue>
    ): VoidFunction => {
        const state = stateCache.get(subject) ?? new MotionValueState(step)

        stateCache.set(subject, state)

        const subscriptions: VoidFunction[] = []

        for (const key in values) {
            const value = values[key]
            const remove = addValue(subject, state, key, value)
            subscriptions.push(remove)
        }

        return () => {
            for (const cancel of subscriptions) cancel()
        }
    }

    return Object.assign(effect, options, {
        get: (subject: Subject, key: string) =>
            stateCache.get(subject)?.get(key),
    })
}
