import { MotionValue } from "../../value"
import { MotionValueState } from "../MotionValueState"

export function createEffect<Subject extends object>(
    addValue: (
        subject: Subject,
        state: MotionValueState,
        key: string,
        value: MotionValue
    ) => VoidFunction
) {
    const stateCache = new WeakMap<Subject, MotionValueState>()

    return (
        subject: Subject,
        values: Record<string, MotionValue>
    ): VoidFunction => {
        const state = stateCache.get(subject) ?? new MotionValueState()

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
}
