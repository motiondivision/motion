import {
    ElementOrSelector,
    resolveElements,
} from "../../utils/resolve-elements"
import { MotionValue } from "../../value"
import { MotionValueState } from "../MotionValueState"
import {
    AnimateEffect,
    Effect,
    EffectOptions,
    EffectRead,
    EffectTest,
} from "./create-effect"

/**
 * The element overloads come last so generic inference sees the subject type.
 */
export interface SelectorEffect<T extends object> extends EffectOptions<T> {
    (
        subject: ElementOrSelector,
        values: Record<string, MotionValue>
    ): VoidFunction
    (subject: T, values: Record<string, MotionValue>): VoidFunction

    get(subject: ElementOrSelector, key: string): MotionValue | undefined
    get(subject: T, key: string): MotionValue | undefined

    flush(subject: T): void
    state(subject: T): MotionValueState | undefined
}

export interface SelectorAnimateEffect<T extends object>
    extends SelectorEffect<T> {
    test: EffectTest<T>
    read: EffectRead<T>
}

/**
 * Wraps a per-element effect so it also accepts selectors and element
 * lists. `test`, `read` and `get` still address a single element, so the
 * result can be registered with `animate.addEffect()`.
 */
export function createSelectorEffect<T extends object>(
    subjectEffect: AnimateEffect<T>
): SelectorAnimateEffect<T>
export function createSelectorEffect<T extends object>(
    subjectEffect: Effect<T>
): SelectorEffect<T>
export function createSelectorEffect<T extends object>(
    subjectEffect: Effect<T>
): SelectorEffect<T> {
    const effect = (
        subject: T | ElementOrSelector,
        values: Record<string, MotionValue>
    ) => {
        const elements = resolveElements(subject as ElementOrSelector)
        const subscriptions: VoidFunction[] = []

        for (const element of elements) {
            const remove = subjectEffect(element as T, values)
            subscriptions.push(remove)
        }

        return () => {
            for (const remove of subscriptions) remove()
        }
    }

    const { test, read, get, flush, state } = subjectEffect

    return Object.assign(effect, {
        test,
        read,
        get: get as SelectorEffect<T>["get"],
        flush,
        state,
    })
}
