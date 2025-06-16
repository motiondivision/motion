import {
    ElementOrSelector,
    resolveElements,
} from "../../utils/resolve-elements"
import { EventOptions } from "../types"

export function setupGesture(
    elementOrSelector: ElementOrSelector,
    options: EventOptions
): [Element[], AddEventListenerOptions, VoidFunction] {
    const elements = resolveElements(elementOrSelector)

    const gestureAbortController = new AbortController()

    const eventOptions = {
        passive: true,
        ...options,
        signal: gestureAbortController.signal,
    }

    const cancel = () => gestureAbortController.abort()

    return [elements, eventOptions, cancel]
}
