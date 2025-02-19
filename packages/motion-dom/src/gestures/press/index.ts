import { ElementOrSelector } from "../../utils/resolve-elements"
import { isDragActive } from "../drag/state/is-active"
import { EventOptions } from "../types"
import { capturePointer } from "../utils/capture-pointer"
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
    targetOrSelector: ElementOrSelector,
    onPressStart: OnPressStartEvent,
    options: PointerEventOptions = {}
): VoidFunction {
    const [targets, eventOptions, cancelEvents] = setupGesture(
        targetOrSelector,
        options
    )

    const startPress = (startEvent: PointerEvent) => {
        const target = startEvent.currentTarget as Element

        if (!target || !isValidPressEvent(startEvent) || isPressing.has(target))
            return

        isPressing.add(target)

        capturePointer(startEvent, "set")

        const onPressEnd = onPressStart(target, startEvent)

        const onPointerEnd = (endEvent: PointerEvent, success: boolean) => {
            target.removeEventListener("pointerup", onPointerUp)
            target.removeEventListener("pointercancel", onPointerCancel)

            capturePointer(endEvent, "release")

            if (!isValidPressEvent(endEvent) || !isPressing.has(target)) {
                return
            }

            isPressing.delete(target)

            if (typeof onPressEnd === "function") {
                onPressEnd(endEvent, { success })
            }
        }

        const onPointerUp = (upEvent: PointerEvent) => {
            const isOutside = !upEvent.isTrusted
                ? false
                : checkOutside(
                      upEvent,
                      target instanceof Element
                          ? target.getBoundingClientRect()
                          : {
                                left: 0,
                                top: 0,
                                right: window.innerWidth,
                                bottom: window.innerHeight,
                            }
                  )

            if (isOutside) {
                onPointerEnd(upEvent, false)
            } else {
                onPointerEnd(
                    upEvent,
                    !(target instanceof Element) ||
                        isNodeOrChild(target, upEvent.target as Element)
                )
            }
        }

        const onPointerCancel = (cancelEvent: PointerEvent) => {
            onPointerEnd(cancelEvent, false)
        }

        target.addEventListener("pointerup", onPointerUp, eventOptions)
        target.addEventListener("pointercancel", onPointerCancel, eventOptions)
        target.addEventListener(
            "lostpointercapture",
            onPointerCancel,
            eventOptions
        )
    }

    targets.forEach((target: EventTarget) => {
        target = options.useGlobalTarget ? window : target

        let canAddKeyboardAccessibility = false

        if (target instanceof HTMLElement) {
            canAddKeyboardAccessibility = true

            if (
                !isElementKeyboardAccessible(target) &&
                target.getAttribute("tabindex") === null
            ) {
                target.tabIndex = 0
            }
        }

        target.addEventListener(
            "pointerdown",
            startPress as EventListener,
            eventOptions
        )

        if (canAddKeyboardAccessibility) {
            target.addEventListener(
                "focus",
                (event) =>
                    enableKeyboardPress(event as FocusEvent, eventOptions),
                eventOptions
            )
        }
    })

    return cancelEvents
}

function checkOutside(
    event: PointerEvent,
    rect: { left: number; top: number; right: number; bottom: number }
) {
    return (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
    )
}
