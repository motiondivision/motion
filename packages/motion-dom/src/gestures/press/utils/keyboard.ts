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
    focusEvent: FocusEvent,
    eventOptions: AddEventListenerOptions
) => {
    const element = focusEvent.currentTarget as HTMLElement
    if (!element) return

    const handleKeydown = filterEvents(() => {
        if (isPressing.has(element)) return

        firePointerEvent(element, "down")

        const handleKeyup = filterEvents(() => {
            firePointerEvent(element, "up")
        })

        const handleBlur = () => firePointerEvent(element, "cancel")

        element.addEventListener("keyup", handleKeyup, eventOptions)
        element.addEventListener("blur", handleBlur, eventOptions)
    })

    element.addEventListener("keydown", handleKeydown, eventOptions)

    /**
     * Add an event listener that fires on blur to remove the keydown events.
     */
    element.addEventListener(
        "blur",
        () => element.removeEventListener("keydown", handleKeydown),
        eventOptions
    )
}
