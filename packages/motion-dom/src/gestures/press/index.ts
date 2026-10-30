import { secondsToMilliseconds } from "motion-utils"
import { cancelFrame, frame } from "../../frameloop/frame"
import { time } from "../../frameloop/sync-time"
import { bindToScope } from "../../scope/active"
import { isHTMLElement } from "../../utils/is-html-element"
import { ElementOrSelector } from "../../utils/resolve-elements"
import { isDragActive } from "../drag/state/is-active"
import { EventOptions } from "../types"
import { isNodeOrChild } from "../utils/is-node-or-child"
import { isPrimaryPointer } from "../utils/is-primary-pointer"
import { setupGesture } from "../utils/setup"
import { OnPressStartEvent, PressHandlers, PressOptions } from "./types"
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

/**
 * Max distance in px between consecutive presses of a `times` sequence.
 * Android's `ViewConfiguration` double tap slop is 100dp.
 */
const sequenceSlop = 100

/**
 * Max distance in px a pointer can move during a held press (`after`
 * pending, or `repeat`). Android's `ViewConfiguration` touch slop is 8dp.
 */
const holdSlop = 8

const exceeds = (a: PointerEvent, b: PointerEvent, max: number) =>
    Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) > max

const preventDefault = (event: Event) => event.preventDefault()

interface PressSequence {
    count: number
    end: number
    event: PointerEvent
}

export interface PointerEventOptions extends EventOptions, PressOptions {
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
 * `onPressStart` can return a function to call when the press ends,
 * or an object of handlers for this press:
 *
 * ```js
 * press(button, () => ({
 *   onComplete: (event, { success }) => {},
 *   onRepeat: (count) => {},
 * }), { repeat: 0.1 })
 * ```
 *
 * @public
 */
export function press(
    targetOrSelector: ElementOrSelector,
    onPressStart: OnPressStartEvent,
    options: PointerEventOptions = {}
): VoidFunction {
    onPressStart = bindToScope(onPressStart)

    const [targets, eventOptions, cancelEvents] = setupGesture(
        targetOrSelector,
        options
    )

    const sequences = new WeakMap<Element, PressSequence>()

    const startPress = (startEvent: PointerEvent) => {
        const target = startEvent.currentTarget as Element

        if (!isValidPressEvent(startEvent)) return
        if (claimedPointerDownEvents.has(startEvent)) return

        if (options.stopPropagation) {
            claimedPointerDownEvents.add(startEvent)
        }

        /**
         * Options are read per press so they can be updated between presses.
         */
        const { times = 1, timesInterval = 0.3, after = 0, repeat } = options
        const downTime = time.now()
        const afterTime = secondsToMilliseconds(after)
        const previous = sequences.get(target)
        const count =
            previous &&
            downTime - previous.end <= secondsToMilliseconds(timesInterval) &&
            !exceeds(previous.event, startEvent, sequenceSlop)
                ? previous.count + 1
                : 1
        const isFinal = count >= times
        const isHeld = isFinal && (after || repeat)

        let isStarted = false
        let repeats = 0
        let handlers: PressHandlers = {}

        const begin = () => {
            isStarted = true
            isPressing.add(target)
            const result = onPressStart(target, startEvent)
            handlers =
                typeof result === "function"
                    ? { onComplete: result }
                    : result || {}
        }

        const tick = () => {
            if (eventOptions.signal!.aborted) return cancelFrame(tick)

            const elapsed = time.now() - downTime

            if (!isStarted) {
                const progress = Math.min(elapsed / afterTime, 1)
                options.onProgress?.(progress)
                if (progress < 1) return
                begin()
            }

            if (!repeat) {
                cancelFrame(tick)
            } else if (
                elapsed - afterTime >=
                (repeats + 1) * secondsToMilliseconds(repeat)
            ) {
                handlers.onRepeat?.(++repeats)
            }
        }

        /**
         * End listeners run in the capture phase so a descendant calling
         * stopPropagation() in its own pointerup handler can't prevent the
         * press gesture from ending. This also keeps the gesture-end
         * ordering consistent with the drag gesture. See #2794.
         */
        const endEventOptions = { ...eventOptions, capture: true }

        const onPointerEnd = (endEvent: PointerEvent, success: boolean) => {
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
            window.removeEventListener(
                "pointermove",
                onPointerMove,
                endEventOptions
            )
            target.removeEventListener("contextmenu", preventDefault)
            cancelFrame(tick)

            if (isStarted) {
                isPressing.delete(target)
            } else if (isHeld) {
                options.onProgress?.(0)
            }

            const isValid = isValidPressEvent(endEvent)

            /**
             * Only successful presses before the final one continue a
             * sequence. Anything else starts a new one.
             */
            success && isValid && !isFinal
                ? sequences.set(target, {
                      count,
                      end: time.now(),
                      event: startEvent,
                  })
                : sequences.delete(target)

            isValid && handlers.onComplete?.(endEvent, { success })
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

        /**
         * Moving during a pending long press, or a repeating press, cancels
         * it, so scrolling on touch devices doesn't trigger it.
         */
        const onPointerMove = (moveEvent: PointerEvent) => {
            if (
                (repeat || !isStarted) &&
                isPrimaryPointer(moveEvent) &&
                exceeds(startEvent, moveEvent, holdSlop)
            ) {
                onPointerCancel(moveEvent)
            }
        }

        window.addEventListener("pointerup", onPointerUp, endEventOptions)
        window.addEventListener(
            "pointercancel",
            onPointerCancel,
            endEventOptions
        )

        if (isFinal && !after) begin()

        if (isHeld) {
            frame.update(tick, true)
            window.addEventListener(
                "pointermove",
                onPointerMove,
                endEventOptions
            )
            /**
             * Touch devices open a context menu or callout on long press,
             * which would cancel the gesture.
             */
            target.addEventListener("contextmenu", preventDefault, {
                ...eventOptions,
                passive: false,
            })
        }
    }

    targets.forEach((target: EventTarget) => {
        const pointerDownTarget = options.useGlobalTarget ? window : target
        pointerDownTarget.addEventListener(
            "pointerdown",
            startPress as EventListener,
            eventOptions
        )

        if (isHTMLElement(target)) {
            target.addEventListener(
                "focus",
                () => enableKeyboardPress(target, eventOptions),
                eventOptions
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
