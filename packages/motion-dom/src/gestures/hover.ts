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

    const onPointerEnter = (enterEvent: PointerEvent) => {
        if (!isValidHover(enterEvent)) return

        const { target } = enterEvent
        const onHoverEnd = onHoverStart(target as Element, enterEvent)

        if (typeof onHoverEnd !== "function" || !target) return

        const onPointerLeave = (leaveEvent: PointerEvent) => {
            if (!isValidHover(leaveEvent)) return

            onHoverEnd(leaveEvent)
            target.removeEventListener(
                "pointerleave",
                onPointerLeave as EventListener
            )
        }

        target.addEventListener(
            "pointerleave",
            onPointerLeave as EventListener,
            eventOptions
        )
    }

    elements.forEach((element) => {
        element.addEventListener(
            "pointerenter",
            onPointerEnter as EventListener,
            eventOptions
        )
    })

    return cancel
}
