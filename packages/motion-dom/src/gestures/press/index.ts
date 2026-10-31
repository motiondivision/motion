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

/**
 * A `times` sequence waiting for its next press.
 */
interface PressSequence {
    count: number
    event: PointerEvent
    handlers: PressHandlers
    expire: (force?: unknown) => true | void
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
 * `onPressStart` fires on the first pointer or key down, and can return
 * a function to call when the press ends, or an object of handlers for
 * this press:
 *
 * ```js
 * press(button, () => ({
 *   onHold: (progress) => {},
 *   onComplete: (event, { success }) => {},
 * }), { after: 0.5 })
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
        const interval = secondsToMilliseconds(timesInterval)
        let previous = sequences.get(target)

        /**
         * A press during a `times` sequence continues it. If it's too late
         * or too far away, the sequence is cancelled and this press starts
         * a new one.
         */
        if (
            previous?.expire(exceeds(previous.event, startEvent, sequenceSlop))
        ) {
            previous = undefined
        } else if (previous) {
            cancelFrame(previous.expire)
            sequences.delete(target)
        }

        const count = previous ? previous.count + 1 : 1
        const isFinal = count >= times
        const isHeld = isFinal && (after || repeat)
        let isActive = !after
        let repeats = 0
        let handlers: PressHandlers

        isPressing.add(target)

        if (previous) {
            handlers = previous.handlers
        } else {
            const result = onPressStart(target, startEvent)
            handlers =
                typeof result === "function"
                    ? { onComplete: result }
                    : result || {}
        }

        /**
         * While held, `onHold` reports progress from 0 to 1 over `after`,
         * then over each `repeat`. Each cycle reports exactly 1 at its end,
         * then 0 on the next frame.
         */
        const repeatTime = secondsToMilliseconds(repeat!)
        let length = afterTime || repeatTime
        let cycleEnd = downTime + length
        let isCycleStart = true

        const tick = () => {
            if (eventOptions.signal!.aborted) return cancelFrame(tick)

            let progress = Math.min(1 - (cycleEnd - time.now()) / length, 1)

            /**
             * The frame after a boundary reports 0, so each cycle visibly
             * restarts. Boundaries are timed from `downTime`, so this
             * doesn't delay the next one. If a long frame has already
             * passed the next boundary, it reports 1 instead.
             */
            if (isCycleStart && progress < 1) progress = 0
            isCycleStart = false
            handlers.onHold?.(progress)

            if (progress < 1) return

            isActive ? handlers.onRepeat?.(++repeats) : (isActive = true)

            if (repeat) {
                isCycleStart = true
                cycleEnd += length = repeatTime
            } else {
                cancelFrame(tick)
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
            isPressing.delete(target)

            if (!isValidPressEvent(endEvent)) return

            if (success && !isFinal) {
                /**
                 * Wait for the next press of the sequence, and cancel the
                 * gesture if it doesn't arrive in time.
                 */
                const end = time.now()

                /**
                 * Cancels the sequence if it's `force`d, or the interval
                 * has passed. Runs every frame, where `force` is frame
                 * data, so it's checked with `=== true`.
                 */
                const expire = (force?: unknown) => {
                    const isAborted = eventOptions.signal!.aborted
                    if (
                        isAborted ||
                        force === true ||
                        time.now() - end > interval
                    ) {
                        cancelFrame(expire)
                        sequences.delete(target)
                        isAborted ||
                            handlers.onComplete?.(endEvent, { success: false })
                        return true
                    }
                }
                sequences.set(target, {
                    count,
                    event: startEvent,
                    handlers,
                    expire,
                })
                frame.update(expire, true)
            } else {
                /**
                 * Releasing before `after` is reached is a cancel.
                 */
                handlers.onComplete?.(endEvent, {
                    success: success && isActive,
                })
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

        /**
         * Moving during a pending long press, or a repeating press, cancels
         * it, so scrolling on touch devices doesn't trigger it.
         */
        const onPointerMove = (moveEvent: PointerEvent) => {
            if (
                (repeat || !isActive) &&
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
