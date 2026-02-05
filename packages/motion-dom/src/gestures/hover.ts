import { ElementOrSelector } from "../utils/resolve-elements"
import { isDragActive } from "./drag/state/is-active"
import { EventOptions } from "./types"
import { setupGesture } from "./utils/setup"

/**
 * A function to be called when a hover gesture starts.
 *
 * This function can optionally return a function that will be called
 * when the hover gesture ends.
 *
 * @public
 */
export type OnHoverStartEvent = (
    element: Element,
    event: PointerEvent
) => void | OnHoverEndEvent

/**
 * A function to be called when a hover gesture ends.
 *
 * @public
 */
export type OnHoverEndEvent = (event: PointerEvent) => void

function isValidHover(event: PointerEvent) {
    return !(event.pointerType === "touch" || isDragActive())
}

/**
 * Create a hover gesture. hover() is different to .addEventListener("pointerenter")
 * in that it has an easier syntax, filters out polyfilled touch events, interoperates
 * with drag gestures, and automatically removes the "pointerennd" event listener when the hover ends.
 *
 * @public
 */
export function hover(
    elementOrSelector: ElementOrSelector,
    onHoverStart: OnHoverStartEvent,
    options: EventOptions = {}
): VoidFunction {
    const [elements, eventOptions, cancel] = setupGesture(
        elementOrSelector,
        options
    )

    elements.forEach((element) => {
        let isPressed = false
        let deferredHoverEnd = false
        let hoverEndCallback: OnHoverEndEvent | undefined

        const removePointerLeave = () => {
            element.removeEventListener(
                "pointerleave",
                onPointerLeave as EventListener
            )
        }

        const endHover = (event: PointerEvent) => {
            if (hoverEndCallback) {
                hoverEndCallback(event)
                hoverEndCallback = undefined
            }
            removePointerLeave()
        }

        const onPointerUp = (event: Event) => {
            isPressed = false
            window.removeEventListener(
                "pointerup",
                onPointerUp as EventListener
            )
            window.removeEventListener(
                "pointercancel",
                onPointerUp as EventListener
            )

            if (deferredHoverEnd) {
                deferredHoverEnd = false
                endHover(event as PointerEvent)
            }
        }

        const onPointerDown = () => {
            isPressed = true
            window.addEventListener(
                "pointerup",
                onPointerUp as EventListener,
                eventOptions
            )
            window.addEventListener(
                "pointercancel",
                onPointerUp as EventListener,
                eventOptions
            )
        }

        const onPointerLeave = (leaveEvent: PointerEvent) => {
            if (leaveEvent.pointerType === "touch") return

            if (isPressed) {
                deferredHoverEnd = true
                return
            }

            endHover(leaveEvent)
        }

        const onPointerEnter = (enterEvent: PointerEvent) => {
            if (!isValidHover(enterEvent)) return

            deferredHoverEnd = false

            const onHoverEnd = onHoverStart(
                element as Element,
                enterEvent
            )

            if (typeof onHoverEnd !== "function") return

            hoverEndCallback = onHoverEnd

            element.addEventListener(
                "pointerleave",
                onPointerLeave as EventListener,
                eventOptions
            )
        }

        element.addEventListener(
            "pointerenter",
            onPointerEnter as EventListener,
            eventOptions
        )
        element.addEventListener(
            "pointerdown",
            onPointerDown as EventListener,
            eventOptions
        )
    })

    return cancel
}
