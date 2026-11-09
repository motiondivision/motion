import { clamp, type Point } from "motion-utils"
import { spring } from "../../animation/generators/spring"
import type { SpringOptions } from "../../animation/types"
import { readStyleValue, styleSubjectEffect } from "../../effects/style"
import { svgSubjectEffect } from "../../effects/svg"
import { cancelFrame, frame } from "../../frameloop"
import { time } from "../../frameloop/sync-time"
import { visualElementStore } from "../../render/store"
import { activeScope, addToScope } from "../../scope/active"
import { isSVGElement } from "../../utils/is-svg-element"
import { mixNumber } from "../../utils/mix/number"
import {
    resolveElements,
    type ElementOrSelector,
} from "../../utils/resolve-elements"
import { motionValue, type MotionValue } from "../../value"
import { setDragLock } from "../drag/state/set-active"
import { applyConstraints, defaultElastic } from "../drag/utils/constraints"
import { elementDragControls } from "../drag/VisualElementDragControls"

/**
 * @public
 */
export interface PinchInfo {
    /**
     * The gesture's focal point in client coordinates: the midpoint
     * between two touches, or the cursor for a trackpad pinch.
     */
    point: Point

    /**
     * How far the focal point has moved since the gesture started.
     */
    offset: Point

    /**
     * The gesture's scale relative to its start.
     */
    scale: number

    /**
     * The gesture's rotation since its start, in degrees.
     */
    rotate: number
}

/**
 * Called with the latest event and the gesture's info.
 *
 * @public
 */
export type OnPinchEvent = (event: Event, info: PinchInfo) => void

/**
 * Handlers for a single pinch gesture, returned from the pinch start
 * callback.
 *
 * @public
 */
export interface PinchHandlers {
    /**
     * Called each frame the gesture changes, after the element's values
     * are updated.
     */
    onPinch?: OnPinchEvent

    /**
     * Called once when the gesture ends: a touch lifts or is cancelled, a
     * trackpad pinch stops, or the gesture is disabled or removed.
     *
     * Returning this function directly from the pinch start callback is
     * equivalent.
     */
    onComplete?: OnPinchEvent
}

/**
 * Called once when a pinch gesture starts: when a second touch lands, on
 * the first trackpad pinch event, or on Safari's `gesturestart`. Can
 * return a function to call when the pinch ends, or an object of
 * `PinchHandlers`.
 *
 * @public
 */
export type OnPinchStartEvent = (
    element: Element,
    event: Event
) => OnPinchEvent | PinchHandlers | void

/**
 * The limits of a pinch's scale or rotation.
 *
 * @public
 */
export interface PinchLimits {
    /**
     * The minimum. Past it, the gesture resists by `elastic`, and the
     * value springs back to it on release.
     */
    min?: number

    /**
     * The maximum. Past it, the gesture resists by `elastic`, and the
     * value springs back to it on release.
     */
    max?: number
}

/**
 * @public
 */
export interface PinchRotateOptions extends PinchLimits {
    /**
     * On release, rotate to the nearest multiple of this many degrees.
     */
    snap?: number
}

/**
 * @public
 */
export interface PinchOptions {
    /**
     * Scale the element. Defaults to `true`. Pass `{ min, max }` to limit
     * the scale.
     */
    scale?: boolean | PinchLimits

    /**
     * Rotate the element with the touches. Defaults to `true`. Pass
     * `{ min, max }` (in degrees) to limit the rotation, and `snap` to
     * rotate to the nearest multiple of `snap` degrees on release.
     */
    rotate?: boolean | PinchRotateOptions

    /**
     * Move the element with the focal point, and keep the point under the
     * fingers (or cursor) in place while scaling and rotating. Defaults to
     * `true`. Composes with drag: a drag that one of the touches started
     * carries on from wherever the pinch leaves the element (its offset
     * restarts there). Drag constraints aren't applied while pinching.
     *
     * Assumes the default `transform-origin` (the element's centre).
     */
    pan?: boolean

    /**
     * How far scale and rotation can go past their limits, as for
     * `dragElastic`: `0` stops at the limit, `1` doesn't resist. Pass
     * `{ min, max }` to set each side. Defaults to `0.35`.
     */
    elastic?: boolean | number | PinchLimits

    /**
     * On release, animate scale back to `1`, and rotation and `x`/`y`
     * back to `0`.
     */
    snapToOrigin?: boolean

    /**
     * The spring values use to animate back inside their limits, to a
     * `snap` angle or to their origin.
     */
    transition?: SpringOptions
}

/**
 * Options for the `pinch` prop.
 *
 * @public
 */
export interface PinchProps extends PinchOptions {
    /**
     * Called when the pinch starts.
     */
    onStart?: OnPinchEvent

    /**
     * Called each frame the pinch changes.
     */
    onMove?: OnPinchEvent

    /**
     * Called when the pinch ends.
     */
    onEnd?: OnPinchEvent
}

export type PinchValues = [
    scale: MotionValue<number>,
    rotate: MotionValue<number>,
    x: MotionValue<number>,
    y: MotionValue<number>
]

/**
 * A trackpad pinch arrives as a stream of `wheel` events with no end
 * event, so it ends once none have arrived for this long.
 */
const wheelTimeout = 150

/**
 * Convert an `x`/`y` set in other units (e.g. `"-50%"` to centre an
 * element) to pixels, so the gesture can add to it.
 */
const toPixels = (value: MotionValue<number>, size: number) => {
    const latest = value.get() as number | string

    if (typeof latest === "string") {
        value.set(parseFloat(latest) * (latest.endsWith("%") ? size / 100 : 1))
    }
}

const limitsOf = (option?: boolean | PinchRotateOptions): PinchRotateOptions =>
    typeof option === "object" ? option : {}

/**
 * Resolve `elastic` to a resistance for each side, as for `dragElastic`.
 */
const resolveElastic = (
    elastic: PinchOptions["elastic"] = defaultElastic
): { min: number; max: number } => {
    const side = (value?: number | boolean) =>
        value === true ? defaultElastic : +(value || 0)

    return typeof elastic === "object"
        ? { min: side(elastic.min), max: side(elastic.max) }
        : { min: side(elastic), max: side(elastic) }
}

const clampTo = (value: number, { min = -Infinity, max = Infinity }) =>
    clamp(min, max, value)

/**
 * The raw gesture value that elastic shows as `value`. A pinch that starts
 * while a value is still past its limit (like during a spring back) carries
 * on from it, rather than jumping.
 */
const unconstrain = (
    value: number,
    option: boolean | PinchRotateOptions | undefined,
    resistance: { min: number; max: number }
) => {
    const limit = clampTo(value, limitsOf(option))
    const elastic = resistance[value < limit ? "min" : "max"]

    return elastic ? limit + (value - limit) / elastic : value
}

/**
 * Listen for pinch gestures on `element`: two touches (or pens), a trackpad
 * pinch (`wheel` with `ctrlKey`, as Chrome, Edge and Firefox report it),
 * and Safari's `gesture*` events.
 *
 * `getValues` is called each time a gesture starts, in the frame's read
 * step, for the scale/rotate/x/y values to write to. It runs alongside the
 * element measurement so neither forces a layout.
 *
 * `getOptions` is read whenever it's needed, so options can change while
 * listening. Return `false` to disable the gesture, which also ends one in
 * progress.
 *
 * `onPinchStart` is called once as each gesture starts, with the gesture's
 * info as a third argument. It can return the gesture's handlers, as for
 * `pinch()`.
 */
export function addPinchListeners(
    element: Element,
    getValues: () => PinchValues,
    getEnabledOptions: () => PinchOptions | false | undefined,
    onPinchStart: (
        element: Element,
        event: Event,
        info: PinchInfo
    ) => ReturnType<OnPinchStartEvent>
): VoidFunction {
    const pointers = new Map<number, Point>()

    /**
     * The gesture as last reported: focal point, log of a distance and an
     * angle. Only changes in distance and angle matter, so trackpad and
     * Safari input write a virtual distance (the scale) here. Logs keep
     * a long trackpad pinch from overflowing.
     */
    const current = { x: 0, y: 0, l: 0, a: 0 }
    const start = { ...current }
    const prev = { ...current }

    let source: "pointer" | "wheel" | "gesture" | undefined
    let lastEvent: Event
    let values: PinchValues | undefined
    let originX = 0
    let originY = 0
    let lastX = 0
    let lastY = 0
    let hasMoved = false
    let wheelTime = 0
    let handlers: PinchHandlers = {}
    let unlock: VoidFunction | null | undefined

    /**
     * The gesture's scale and rotation before limits and elastic apply.
     */
    let rawScale = 1
    let rawRotate = 0
    let stopSnap = () => {}

    /**
     * The latest enabled options, so a gesture disabled mid-way can still
     * report its end.
     */
    let options: PinchOptions = {}
    const getOptions = () => (options = getEnabledOptions() || options)

    const info = (): PinchInfo => ({
        point: { x: current.x, y: current.y },
        offset: { x: current.x - start.x, y: current.y - start.y },
        scale: Math.exp(current.l - start.l),
        rotate: current.a - start.a,
    })

    /**
     * Read the element's box and values, and find its layout origin: its
     * centre without `x`/`y`. Scale and rotate are applied around the
     * centre (the default transform origin), so they don't move it.
     */
    const measure = () => {
        const { left, top, width, height } = element.getBoundingClientRect()
        const { scale, rotate, pan, elastic } = getOptions()
        const [s, r, x, y] = (values = getValues())
        const resistance = resolveElastic(elastic)

        /**
         * Stop animations on values this gesture writes, and leave the
         * rest running.
         */
        scale !== false && s.stop()
        rotate !== false && r.stop()
        rawScale = unconstrain(s.get(), scale, resistance)
        rawRotate = unconstrain(r.get(), rotate, resistance)

        if (pan !== false) {
            x.stop()
            y.stop()
            toPixels(x, (element as HTMLElement).offsetWidth ?? width)
            toPixels(y, (element as HTMLElement).offsetHeight ?? height)
        }

        lastX = x.get()
        lastY = y.get()
        originX = left + width / 2 - lastX
        originY = top + height / 2 - lastY
    }

    const dragControls = () =>
        elementDragControls.get(visualElementStore.get(element)!)

    /**
     * On release, spring scale and rotation back inside their limits (or
     * to a `snap` angle), keeping the focal point in place, or everything
     * back to its origin with `snapToOrigin`.
     */
    const snap = () => {
        const {
            scale: scaleOption,
            rotate: rotateOption,
            pan,
            snapToOrigin,
            transition,
        } = options
        const [scale, rotate, x, y] = values!
        const s0 = scale.get()
        const r0 = rotate.get()
        const x0 = x.get()
        const y0 = y.get()
        const { snap: step } = limitsOf(rotateOption)
        let s1 = clampTo(s0, limitsOf(scaleOption))
        let r1 = clampTo(
            step ? Math.round(r0 / step) * step : r0,
            limitsOf(rotateOption)
        )

        if (snapToOrigin) {
            s1 = 1
            r1 = 0
        }

        /**
         * Keep the focal point in place, unless the element doesn't move
         * with it, or a drag carries on and owns x/y.
         */
        const moves = pan !== false && !dragControls()?.isDragging
        const vx = originX + x0 - current.x
        const vy = originY + y0 - current.y

        if (
            !s0 ||
            (s1 === s0 && r1 === r0 && !(snapToOrigin && moves && (x0 || y0)))
        ) {
            return
        }

        const generator = spring({
            keyframes: [0, 1],
            stiffness: 200,
            damping: 40,
            ...transition,
        })
        const startTime = time.now()

        /**
         * Drive the values from one spring, from 0 to 1, so they stay in
         * step and the focal point stays in place.
         */
        const tick = () => {
            if (dragControls()?.isDragging) return stopSnap()

            const { value: p, done } = generator.next(time.now() - startTime)
            if (done) stopSnap()

            const k = mixNumber(s0, s1, p)
            const r = mixNumber(r0, r1, p)
            const angle = ((r - r0) * Math.PI) / 180
            const cos = (Math.cos(angle) * k) / s0
            const sin = (Math.sin(angle) * k) / s0

            scaleOption !== false && scale.set(k)
            rotateOption !== false && rotate.set(r)

            if (moves) {
                x.set(
                    snapToOrigin
                        ? mixNumber(x0, 0, p)
                        : x0 + cos * vx - sin * vy - vx
                )
                y.set(
                    snapToOrigin
                        ? mixNumber(y0, 0, p)
                        : y0 + sin * vx + cos * vy - vy
                )
            }
        }

        stopSnap = () => cancelFrame(tick)
        frame.update(tick, true)
    }

    /**
     * Apply the change in the gesture since the last frame as an
     * incremental scale and rotation around the previous focal point,
     * plus the focal point's movement.
     */
    const apply = () => {
        if (!values || !hasMoved) return
        hasMoved = false

        const {
            rotate: rotateOption,
            scale: scaleOption,
            pan,
            elastic,
        } = getOptions()
        const [scale, rotate, x, y] = values
        const resistance = resolveElastic(elastic)
        const latest = scale.get()
        let theta = 0
        let k = 1

        /**
         * Apply limits and elastic to the gesture's raw scale and rotation.
         * At a hard limit, the raw value stops too, so moving back responds
         * straight away.
         */
        const constrain = (raw: number, option?: boolean | PinchLimits) => {
            const limits = limitsOf(option)
            const limit = clampTo(raw, limits)

            return resistance[raw < limit ? "min" : "max"]
                ? [applyConstraints(raw, limits, resistance), raw]
                : [limit, limit]
        }

        if (scaleOption !== false && latest) {
            const [next, raw] = constrain(
                clamp(1e-9, 1e9, rawScale * Math.exp(current.l - prev.l)),
                scaleOption
            )
            rawScale = raw
            k = next / latest
            scale.set(next)
        }

        if (rotateOption !== false) {
            const [next, raw] = constrain(
                rawRotate + current.a - prev.a,
                rotateOption
            )
            rawRotate = raw
            theta = next - rotate.get()
            if (theta) rotate.set(next)
        }

        if (pan !== false) {
            /**
             * Pinch owns x/y while it runs, so stop any animation started
             * on them since (like a drag's snap back) taking over after.
             */
            x.stop()
            y.stop()

            /**
             * If drag() or the drag prop is dragging this element with one
             * of the touches, it has set x/y this frame to where it started
             * plus the touch's offset. Carry on from our own values instead,
             * and restart the drag from them and the touch's latest point.
             * That way it continues from wherever the pinch leaves the
             * element, and its release velocity only counts movement after
             * the pinch, so a zoom doesn't end in a fling.
             */
            const drag = dragControls()
            const isDragging = drag?.isDragging

            if (!isDragging) {
                lastX = x.get()
                lastY = y.get()
            }

            const angle = (theta * Math.PI) / 180
            const cos = Math.cos(angle) * k
            const sin = Math.sin(angle) * k
            const dx = prev.x - originX - lastX
            const dy = prev.y - originY - lastY

            /**
             * Move the centre so the previous focal point, scaled and
             * rotated around the centre, lands on the current focal point.
             */
            lastX += dx + current.x - prev.x - (cos * dx - sin * dy)
            lastY += dy + current.y - prev.y - (sin * dx + cos * dy)

            if (isDragging) {
                const history = drag!.panSession!.history
                history.splice(0, history.length - 1)

                /**
                 * Date the point long ago, so drag only measures release
                 * velocity from moves after the pinch. A move that drag
                 * processes as the touch lifts is part of the pinch.
                 */
                history[0].timestamp = -Infinity
                drag!.originPoint.x = lastX
                drag!.originPoint.y = lastY
            }

            x.set(lastX)
            y.set(lastY)
        }

        Object.assign(prev, current)
        handlers.onPinch?.(lastEvent, info())
    }

    /**
     * Runs after the update step, where drag sets x/y, so it has the final
     * say on them each frame.
     */
    const update = () => {
        if (!getEnabledOptions()) return end(lastEvent)

        apply()

        if (source === "wheel" && time.now() - wheelTime > wheelTimeout) {
            end(lastEvent)
        }
    }

    const begin = (event: Event, from: typeof source) => {
        if (!getEnabledOptions()) return

        stopSnap()
        source = from
        lastEvent = event
        hasMoved = false
        values = undefined
        handlers = {}
        Object.assign(start, current)
        Object.assign(prev, current)
        frame.read(measure)
        frame.preRender(update, true)

        const result = onPinchStart(element, event, info())
        handlers =
            typeof result === "function" ? { onComplete: result } : result || {}
    }

    const end = (event: Event) => {
        if (!source) return
        cancelFrame(measure)
        cancelFrame(update)

        if (getEnabledOptions()) {
            apply()
            values && snap()
        }

        source = undefined
        handlers.onComplete?.(event, info())
    }

    const moved = (event: Event) => {
        lastEvent = event
        hasMoved = true
    }

    const readPointers = () => {
        const [a, b] = pointers.values()
        const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
        const delta = angle - current.a

        current.x = (a.x + b.x) / 2
        current.y = (a.y + b.y) / 2
        current.l = Math.log(Math.hypot(b.x - a.x, b.y - a.y) || 1)

        /**
         * Take the shortest way round, so rotation keeps counting past
         * 180deg rather than flipping to -180deg.
         */
        current.a += delta - 360 * Math.round(delta / 360)
    }

    const setPointer = (event: PointerEvent) =>
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    const onPointerMove = (event: PointerEvent) => {
        if (!pointers.has(event.pointerId)) return
        setPointer(event)

        if (source === "pointer") {
            readPointers()
            moved(event)
        }
    }

    const onPointerUp = (event: PointerEvent) => {
        if (!pointers.delete(event.pointerId)) return

        if (source === "pointer") end(event)

        if (!pointers.size) {
            toggleWindowListeners()
            release()
        }
    }

    /**
     * Once a touch is down on the element, listen on the window too, so
     * the second touch can land beside it (for instance on a small image).
     */
    const onPointerDown = (event: PointerEvent) => {
        if (
            source ||
            pointers.size > 1 ||
            pointers.has(event.pointerId) ||
            event.pointerType === "mouse"
        ) {
            return
        }

        if (!pointers.size) toggleWindowListeners(true)
        setPointer(event)

        if (pointers.size === 2) {
            readPointers()
            begin(event, "pointer")

            /**
             * Unless this element drags, hold the drag lock until every
             * touch lifts. A press on it then ends as a cancel, rather than
             * a tap, and a draggable parent doesn't drag.
             */
            if (
                source &&
                !unlock &&
                !elementDragControls.get(visualElementStore.get(element)!)
            ) {
                unlock = setDragLock(true)
            }
        }
    }

    /**
     * Release the drag lock a frame later, so a press ending on this same
     * pointerup still sees it.
     */
    const release = () => {
        const done = unlock
        unlock = undefined
        done && frame.postRender(done)
    }

    const toggleWindowListeners = (add?: boolean) => {
        const method = add ? "addEventListener" : "removeEventListener"
        window[method]("pointerdown", onPointerDown as EventListener)
        window[method]("pointermove", onPointerMove as EventListener)
        window[method]("pointerup", onPointerUp as EventListener)
        window[method]("pointercancel", onPointerUp as EventListener)
    }

    const onWheel = (event: WheelEvent) => {
        if (!event.ctrlKey || (source && source !== "wheel")) return

        current.x = event.clientX
        current.y = event.clientY

        if (!source) {
            current.l = 0
            begin(event, "wheel")
            if (!source) return
        }

        event.preventDefault()

        /**
         * Lines (Firefox's mouse wheel) to pixels, and cap each event so a
         * mouse wheel notch with ctrl held (about 100px) zooms a step.
         */
        current.l -=
            clamp(-50, 50, event.deltaY * (event.deltaMode ? 16 : 1)) / 100
        wheelTime = time.now()
        moved(event)
    }

    /**
     * Safari reports trackpad pinches as `gesture*` events. iOS Safari
     * fires them for touches too, alongside the pointer events we track.
     */
    const onGesture = (event: Event) => {
        if (!pointers.size && (!source || source === "gesture")) {
            const { scale, rotation, clientX, clientY } = event as any
            current.x = clientX
            current.y = clientY
            current.l = Math.log(scale)
            current.a = rotation

            if (source) {
                moved(event)
                if (event.type === "gestureend") end(event)
            } else if (event.type === "gesturestart") {
                begin(event, "gesture")
            }
        }

        if (source) event.preventDefault()
    }

    const listeners = {
        pointerdown: onPointerDown,
        wheel: onWheel,
        gesturestart: onGesture,
        gesturechange: onGesture,
        gestureend: onGesture,
    }

    for (const name in listeners) {
        element.addEventListener(
            name,
            listeners[name as keyof typeof listeners] as EventListener,
            { passive: false }
        )
    }

    return () => {
        for (const name in listeners) {
            element.removeEventListener(
                name,
                listeners[name as keyof typeof listeners] as EventListener
            )
        }
        toggleWindowListeners()
        end(lastEvent)
        stopSnap()
        pointers.clear()
        release()
    }
}

const valueKeys = ["scale", "rotate", "x", "y"]

/**
 * The element's scale/rotate/x/y motion values: those of its
 * VisualElement if it has one (it's a <motion.*> component, or drag() or
 * animateLayout() own it), otherwise those animate() binds to it, created
 * from its current style if this is the first time.
 */
const getElementValues = (element: HTMLElement | SVGElement) => {
    const visualElement = visualElementStore.get(element)
    const effect = isSVGElement(element) ? svgSubjectEffect : styleSubjectEffect

    return valueKeys.map((key) => {
        if (visualElement) {
            return visualElement.getValue(key, key === "scale" ? 1 : 0)
        }

        let value = effect.get(element as any, key)

        if (!value) {
            value = motionValue(readStyleValue(element, key))
            effect(element as any, { [key]: value })
        }

        return value
    }) as PinchValues
}

/**
 * Make elements pinchable. Returns a function that removes the gesture.
 * The start callback is optional:
 *
 * ```javascript
 * pinch("img")
 * ```
 *
 * ```javascript
 * const stop = pinch("#photo", (element, startEvent) => {
 *   return (endEvent, info) => {}
 * }, { min: 1, max: 4 })
 * ```
 *
 * `onPinchStart` is called once as each pinch starts. It can return a
 * function to call when the pinch ends, or an object of handlers:
 *
 * ```javascript
 * pinch("#photo", () => ({
 *   onPinch: (event, { scale }) => {},
 *   onComplete: (event, info) => {},
 * }))
 * ```
 *
 * Touches, trackpad pinches and Safari's gesture events scale the element
 * around the focal point and move it with the touches. Its `scale`,
 * `rotate`, `x` and `y` are motion values shared with `animate()`, so an
 * `onComplete` handler can animate the element after a pinch.
 *
 * @public
 */
export function pinch(
    elementOrSelector: ElementOrSelector,
    onPinchStart: OnPinchStartEvent = () => {},
    options: PinchOptions = {}
): VoidFunction {
    const scope = activeScope.current

    /**
     * Run the start callback and the handlers it returns in the active
     * scope, so work they start is collected. A returned function is
     * bound by `scope.bind` itself.
     */
    if (scope) {
        const start = scope.bind(onPinchStart)
        onPinchStart = (element, event) => {
            const result = start(element, event)
            if (typeof result !== "object") return result

            const handlers: PinchHandlers = {}
            for (const key in result) {
                const name = key as keyof PinchHandlers
                const handler = result[name]
                handlers[name] = handler && scope.bind(handler)
            }
            return handlers
        }
    }

    const cleanups = resolveElements(elementOrSelector).map((element) => {
        scope?.track(element)

        const { style } = element as HTMLElement
        const touchAction = style.touchAction
        style.touchAction = "none"

        const remove = addPinchListeners(
            element,
            () => getElementValues(element as HTMLElement),
            () => options,
            onPinchStart
        )

        return () => {
            remove()
            style.touchAction = touchAction
        }
    })

    return addToScope(() => cleanups.forEach((cleanup) => cleanup()))
}
