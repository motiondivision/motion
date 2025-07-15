import { MotionValue } from "../../value"
import { MotionNodeState } from "../MotionNodeState"

export function createEffect<Subject extends object>(
    addValue: (
        subject: Subject,
        state: MotionNodeState,
        key: string,
        value: MotionValue
    ) => VoidFunction,
    stateCache = new WeakMap<Subject, MotionNodeState>()
) {
    const subscriptions: VoidFunction[] = []

    return (
        subject: Subject,
        values: Record<string, MotionValue>
    ): VoidFunction => {
        const state = stateCache.get(subject) ?? new MotionNodeState<Subject>()

        stateCache.set(subject, state)

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
