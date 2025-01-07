import { ElementOrSelector } from "../../utils/resolve-elements"
import { isDragActive } from "../drag/state/is-active"
import { EventOptions } from "../types"
import { isNodeOrChild } from "../utils/is-node-or-child"
import { isPrimaryPointer } from "../utils/is-primary-pointer"
import { setupGesture } from "../utils/setup"
import { OnPressStartEvent } from "./types"
import { isElementKeyboardAccessible } from "./utils/is-keyboard-accessible"
import { enableKeyboardPress } from "./utils/keyboard"
import { isPressing } from "./utils/state"

/**
 * Filter out events that are not primary pointer events, or are triggering
 * while a Motion gesture is active.
 */
function isValidPressEvent(event: PointerEvent) {
    return isPrimaryPointer(event) && !isDragActive()
}

export interface PointerEventOptions extends EventOptions {
    useGlobalTarget?: boolean
}

/**
 * Create a press gesture.
 *
 * Press is different to `"pointerdown"`, `"pointerup"` in that it
 * automatically filters out secondary pointer events like right
 * click and multitouch.
 *
 * It also adds accessibility support for keyboards, where
 * an element with a press gesture will receive focus and
 *  trigger on Enter `"keydown"` and `"keyup"` events.
 *
 * This is different to a browser's `"click"` event, which does
 * respond to keyboards but only for the `"click"` itself, rather
 * than the press start and end/cancel. The element also needs
 * to be focusable for this to work, whereas a press gesture will
 * make an element focusable by default.
 *
 * @public
 */
export function press(
    elementOrSelector: ElementOrSelector,
    onPressStart: OnPressStartEvent,
    options: PointerEventOptions = {}
): VoidFunction {
    const [elements, eventOptions, cancelEvents] = setupGesture(
        elementOrSelector,
        options
    )

    const startPress = (startEvent: PointerEvent) => {
        const element = startEvent.currentTarget as Element

        if (!isValidPressEvent(startEvent) || isPressing.has(element)) return

        isPressing.add(element)

        const onPressEnd = onPressStart(startEvent)

        const onPointerEnd = (endEvent: PointerEvent, success: boolean) => {
            window.removeEventListener("pointerup", onPointerUp)
            window.removeEventListener("pointercancel", onPointerCancel)

            if (!isValidPressEvent(endEvent) || !isPressing.has(element)) {
                return
            }

            isPressing.delete(element)

            if (onPressEnd) {
                onPressEnd(endEvent, { success })
            }
        }

        const onPointerUp = (upEvent: PointerEvent) => {
            onPointerEnd(
                upEvent,
                options.useGlobalTarget ||
                    isNodeOrChild(element, upEvent.target as Element)
            )
        }

        const onPointerCancel = (cancelEvent: PointerEvent) => {
            onPointerEnd(cancelEvent, false)
        }

        window.addEventListener("pointerup", onPointerUp, eventOptions)
        window.addEventListener("pointercancel", onPointerCancel, eventOptions)
    }

    elements.forEach((element: HTMLElement) => {
        if (
            !isElementKeyboardAccessible(element) &&
            element.getAttribute("tabindex") === null
        ) {
            element.tabIndex = 0
        }

        const target = options.useGlobalTarget ? window : element
        target.addEventListener("pointerdown", startPress, eventOptions)

        element.addEventListener(
            "focus",
            (event) => enableKeyboardPress(event, eventOptions),
            eventOptions
        )
    })

    return cancelEvents
}
