import { isHTMLElement } from "../../utils/is-html-element"
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

const claimedPointerDownEvents = new WeakSet<Event>()

export interface PointerEventOptions extends EventOptions {
    useGlobalTarget?: boolean
    stopPropagation?: boolean
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

        if (!isValidPressEvent(startEvent)) return
        if (claimedPointerDownEvents.has(startEvent)) return

        isPressing.add(target)

        if (options.stopPropagation) {
            claimedPointerDownEvents.add(startEvent)
        }

        const onPressEnd = onPressStart(target, startEvent)

        /**
         * End listeners run in the capture phase so a descendant calling
         * stopPropagation() in its own pointerup handler can't prevent the
         * press gesture from ending. This also keeps the gesture-end
         * ordering consistent with the drag gesture. See #2794.
         */
        const endEventOptions = { ...eventOptions, capture: true }

        const onPointerEnd = (endEvent: PointerEvent, success: boolean) => {
            if (typeof window !== "undefined") {
                window.removeEventListener(
                    "pointerup",
                    onPointerUp,
                    endEventOptions
                )
                window.removeEventListener(
                    "pointercancel",
                    onPointerCancel,
                    endEventOptions
                )
            }

            if (isPressing.has(target)) {
                isPressing.delete(target)
            }

            if (!isValidPressEvent(endEvent)) {
                return
            }

            if (typeof onPressEnd === "function") {
                onPressEnd(endEvent, { success })
            }
        }

        const onPointerUp = (upEvent: PointerEvent) => {
            onPointerEnd(
                upEvent,
                (target as any) === window ||
                    (target as any) === document ||
                    options.useGlobalTarget ||
                    isNodeOrChild(target, upEvent.target as Element)
            )
        }

        const onPointerCancel = (cancelEvent: PointerEvent) => {
            onPointerEnd(cancelEvent, false)
        }

        if (typeof window !== "undefined") {
            window.addEventListener("pointerup", onPointerUp, endEventOptions)
            window.addEventListener(
                "pointercancel",
                onPointerCancel,
                endEventOptions
            )
        }
    }

    targets.forEach((target: EventTarget) => {
        const pointerDownTarget =
            options.useGlobalTarget && typeof window !== "undefined"
                ? window
                : target
        pointerDownTarget.addEventListener(
            "pointerdown",
            startPress as EventListener,
            eventOptions
        )

        if (isHTMLElement(target)) {
            target.addEventListener("focus", (event) =>
                enableKeyboardPress(event as FocusEvent, eventOptions)
            )

            if (
                !isElementKeyboardAccessible(target) &&
                !target.hasAttribute("tabindex")
            ) {
                target.tabIndex = 0
            }
        }
    })

    return cancelEvents
}
