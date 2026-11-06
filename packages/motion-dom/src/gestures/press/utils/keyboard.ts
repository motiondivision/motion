import { isPressing } from "./state"

/**
 * Filter out events that are not "Enter" keys.
 */
function filterEvents(callback: (event: KeyboardEvent) => void) {
    return (event: KeyboardEvent) => {
        if (event.key !== "Enter") return
        callback(event)
    }
}

function firePointerEvent(target: EventTarget, type: "down" | "up" | "cancel") {
    target.dispatchEvent(
        new PointerEvent("pointer" + type, { isPrimary: true, bubbles: true })
    )
}

export const enableKeyboardPress = (
    element: HTMLElement,
    eventOptions: AddEventListenerOptions
) => {
    /**
     * Listeners are scoped to this focus and all released on blur, rather
     * than added per Enter press, so they can't accumulate and fire
     * duplicate pointerup/pointercancel events. See #3935.
     */
    let isKeyPressing = false

    const handleKeydown = filterEvents(() => {
        if (isKeyPressing || isPressing.has(element)) return
        isKeyPressing = true
        firePointerEvent(element, "down")
    })

    const handleKeyup = filterEvents(() => {
        if (!isKeyPressing) return
        isKeyPressing = false
        firePointerEvent(element, "up")
    })

    element.addEventListener("keydown", handleKeydown, eventOptions)
    element.addEventListener("keyup", handleKeyup, eventOptions)

    /**
     * On blur, remove the key listeners and cancel any keyboard press.
     */
    element.addEventListener(
        "blur",
        () => {
            element.removeEventListener("keydown", handleKeydown)
            element.removeEventListener("keyup", handleKeyup)
            if (isKeyPressing) firePointerEvent(element, "cancel")
        },
        { ...eventOptions, once: true }
    )
}
