import {
    ElementOrSelector,
    resolveElements,
} from "../../utils/resolve-elements"
import { MotionValue } from "../../value"

export function createSelectorEffect<T>(
    subjectEffect: (
        subject: T,
        values: Record<string, MotionValue>
    ) => VoidFunction
) {
    return (
        subject: ElementOrSelector,
        values: Record<string, MotionValue>
    ) => {
        const elements = resolveElements(subject)
        const subscriptions: VoidFunction[] = []

        for (const element of elements) {
            const remove = subjectEffect(element as T, values)
            subscriptions.push(remove)
        }

        return () => {
            for (const remove of subscriptions) remove()
        }
    }
}
