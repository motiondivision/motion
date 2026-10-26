import { clamp, type Point } from "motion-utils"
import { readStyleValue, styleSubjectEffect } from "../../effects/style"
import { svgSubjectEffect } from "../../effects/svg"
import { cancelFrame, frame } from "../../frameloop"
import { time } from "../../frameloop/sync-time"
import { visualElementStore } from "../../render/store"
import { activeScope, addToScope } from "../../scope/active"
import { isSVGElement } from "../../utils/is-svg-element"
import {
    resolveElements,
    type ElementOrSelector,
} from "../../utils/resolve-elements"
import { motionValue, type MotionValue } from "../../value"
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

export type PinchHandler = (event: Event, info: PinchInfo) => void

/**
 * @public
 */
export interface PinchOptions {
    /**
     * Scale the element. Defaults to `true`.
     */
    scale?: boolean

    /**
     * Rotate the element with the touches. Defaults to `false`.
     */
    rotate?: boolean

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
     * The minimum scale.
     */
    min?: number

    /**
     * The maximum scale.
     */
    max?: number

    onStart?: PinchHandler
    onMove?: PinchHandler
    onEnd?: PinchHandler
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
 */
export function addPinchListeners(
    element: Element,
    getValues: () => PinchValues,
    getEnabledOptions: () => PinchOptions | false | undefined
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
        const { scale, rotate, pan } = getOptions()
        const [s, r, x, y] = (values = getValues())

        /**
         * Stop animations on values this gesture writes, and leave the
         * rest running.
         */
        scale !== false && s.stop()
        rotate && r.stop()

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

    /**
     * Apply the change in the gesture since the last frame as an
     * incremental scale and rotation around the previous focal point,
     * plus the focal point's movement.
     */
    const apply = () => {
        if (!values || !hasMoved) return
        hasMoved = false

        const {
            rotate: canRotate,
            scale: canScale,
            pan,
            min,
            max,
            onMove,
        } = getOptions()
        const [scale, rotate, x, y] = values
        const theta = canRotate ? current.a - prev.a : 0
        const latest = scale.get()
        let k = 1

        if (canScale !== false && latest) {
            const next = clamp(
                min ?? 0,
                max ?? Infinity,
                latest * Math.exp(current.l - prev.l)
            )
            k = next / latest
            scale.set(next)
        }

        if (theta) rotate.set(rotate.get() + theta)

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
            const drag = elementDragControls.get(
                visualElementStore.get(element)!
            )
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
                const history = drag!.panSession?.history
                history?.splice(0, history.length - 1)
                drag!.originPoint.x = lastX
                drag!.originPoint.y = lastY
            }

            x.set(lastX)
            y.set(lastY)
        }

        Object.assign(prev, current)
        onMove?.(lastEvent, info())
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

        source = from
        lastEvent = event
        hasMoved = false
        values = undefined
        Object.assign(start, current)
        Object.assign(prev, current)
        frame.read(measure)
        frame.preRender(update, true)
        getOptions().onStart?.(event, info())
    }

    const end = (event: Event) => {
        if (!source) return
        cancelFrame(measure)
        cancelFrame(update)
        getEnabledOptions() && apply()
        source = undefined
        getOptions().onEnd?.(event, info())
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

        if (!pointers.size) toggleWindowListeners()
        if (source === "pointer") end(event)
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
        }
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
        pointers.clear()
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
 *
 * ```javascript
 * const stop = pinch("#photo", { min: 1, max: 4 })
 * ```
 *
 * Touches, trackpad pinches and Safari's gesture events scale the element
 * around the focal point and move it with the touches. Its `scale`,
 * `rotate`, `x` and `y` are motion values shared with `animate()`, so an
 * `onEnd` callback can animate the element after a pinch.
 *
 * @public
 */
export function pinch(
    elementOrSelector: ElementOrSelector,
    options: PinchOptions = {}
): VoidFunction {
    const scope = activeScope.current

    /**
     * Run callbacks in the active scope, so work they start is collected.
     */
    if (scope) {
        options = { ...options }
        for (const key in options) {
            const value = options[key as keyof PinchOptions]
            if (typeof value === "function") {
                ;(options as any)[key] = scope.bind(value)
            }
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
            () => options
        )

        return () => {
            remove()
            style.touchAction = touchAction
        }
    })

    return addToScope(() => cleanups.forEach((cleanup) => cleanup()))
}
