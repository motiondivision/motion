import { clamp, type BoundingBox } from "motion-utils"
import { spring } from "../../animation/generators/spring"
import type { SpringOptions } from "../../animation/types"
import { cancelFrame, frame } from "../../frameloop"
import { time } from "../../frameloop/sync-time"
import type { MotionValue } from "../../value"
import { resize } from "../../resize"
import {
    resolveElements,
    type ElementOrSelector,
} from "../../utils/resolve-elements"
import { getElementValues } from "../utils/element-values"

/**
 * Which box element constraints keep inside the constraining element.
 *
 * - `"layout"`: the element's box without its transform, as drag
 *   constraints have always measured it.
 * - `"visual"`: the box as drawn, scaled and rotated (around the
 *   element's centre, the default `transform-origin`).
 *
 * @public
 */
export type ConstraintsType = "layout" | "visual"

/**
 * @public
 */
export interface ConstraintsTransform {
    scale: number
    rotate: number
}

/**
 * Returns the `x`/`y` limits for a scale and rotation.
 *
 * @public
 */
export type ConstraintsFunction = (
    transform: ConstraintsTransform
) => Partial<BoundingBox>

/**
 * What constraints keep an element within: an element (or a ref to one),
 * `top`/`left`/`right`/`bottom` limits for `x`/`y` in pixels, or a
 * function that returns them for a scale and rotation.
 *
 * @public
 */
export type ConstraintsTarget =
    | Element
    | { current: Element | null }
    | Partial<BoundingBox>
    | ConstraintsFunction

/**
 * @public
 */
export interface ConstrainOptions {
    /**
     * Defaults to `"visual"`.
     */
    type?: ConstraintsType

    /**
     * The spring `x`/`y` use to move back inside the constraints when an
     * animation finishes outside them.
     */
    transition?: SpringOptions
}

/**
 * Constraints that `drag()`, `pinch()` and `constrain()` share.
 *
 * @public
 */
export interface Constraints {
    /**
     * The `x`/`y` limits, in pixels, at a scale and rotation (by default
     * `1` and `0`). For example, where a double-tap zoom can move to.
     */
    at(transform?: Partial<ConstraintsTransform>): Partial<BoundingBox>

    /**
     * Measure the element and the constraining element again.
     */
    measure(): void

    /**
     * Hold the constraints while a gesture owns `x`/`y`, so `constrain()`
     * doesn't move the element. Returns a function that releases it.
     */
    hold(): VoidFunction

    /**
     * Stop keeping the element within the constraints.
     */
    stop(): void
}

export interface Bounds extends Constraints {
    held: number
    onHold?: VoidFunction
    onRelease?: VoidFunction
}

/**
 * `constrain()` instances, by the element they constrain, so gestures on
 * the element can hold them.
 */
export const elementConstraints = new WeakMap<Element, Bounds>()

export const isConstraints = (value: unknown): value is Constraints =>
    !!value && typeof value === "object" && "hold" in value

export const isElement = (value: unknown): value is Element =>
    !!value && typeof value === "object" && "getBoundingClientRect" in value

const toPixels = (value: unknown) => parseFloat(value as string) || 0

/**
 * The limits along one axis that keep a box of half-length `half`, whose
 * layout centre is at `centre`, between `min` and `max`. If the box is
 * longer than the space, they flip, so it covers the space instead.
 */
const axisLimits = (min: number, max: number, half: number, centre: number) => {
    const a = min + half - centre
    const b = max - half - centre
    return a < b ? [a, b] : [b, a]
}

/**
 * Create the constraints for `element`. `getXY` returns the element's
 * `x`/`y` when measuring.
 *
 * Element constraints are measured once (on the first `at()`, or when
 * `measure()` is called, as gestures do when they start). After that, the
 * limits at any scale and rotation are calculated without reading the
 * DOM.
 */
export function createBounds(
    element: Element,
    target: ConstraintsTarget,
    type: ConstraintsType = "visual",
    getXY: () => [unknown, unknown]
): Bounds {
    let width = 0
    let height = 0
    let centreX = 0
    let centreY = 0
    let frameBox: DOMRect | undefined

    const resolveTarget = () =>
        target && "current" in target ? target.current : target

    const bounds: Bounds = {
        held: 0,
        measure() {
            const constraint = resolveTarget()
            if (!isElement(constraint)) return

            const box = element.getBoundingClientRect()
            const [x, y] = getXY()

            width = (element as HTMLElement).offsetWidth ?? box.width
            height = (element as HTMLElement).offsetHeight ?? box.height

            /**
             * Scale and rotation pivot around the centre, so the drawn
             * box's centre is the layout centre plus x/y.
             */
            centreX = box.left + box.width / 2 - toPixels(x)
            centreY = box.top + box.height / 2 - toPixels(y)
            frameBox = constraint.getBoundingClientRect()
        },
        at({ scale = 1, rotate = 0 } = {}) {
            const constraint = resolveTarget()

            if (typeof constraint === "function") {
                return constraint({ scale, rotate })
            }

            if (!isElement(constraint)) return constraint || {}

            frameBox || bounds.measure()
            if (!frameBox) return {}

            const visual = type === "visual"
            const s = visual ? scale : 1
            const angle = visual ? (rotate * Math.PI) / 180 : 0
            const cos = Math.abs(Math.cos(angle))
            const sin = Math.abs(Math.sin(angle))

            /**
             * Half the size of the box around the scaled, rotated element.
             */
            const halfX = ((width * cos + height * sin) * s) / 2
            const halfY = ((width * sin + height * cos) * s) / 2

            const [left, right] = axisLimits(
                frameBox.left,
                frameBox.right,
                halfX,
                centreX
            )
            const [top, bottom] = axisLimits(
                frameBox.top,
                frameBox.bottom,
                halfY,
                centreY
            )

            return { left, right, top, bottom }
        },
        hold() {
            bounds.onHold?.()
            bounds.held++
            let released = false

            return () => {
                if (released) return
                released = true
                bounds.held--
                bounds.held || bounds.onRelease?.()
            }
        },
        stop() {},
    }

    return bounds
}

/**
 * Hold `constraints`, and any `constrain()` on `element`, while a gesture
 * owns its `x`/`y`. Returns a function that releases them.
 */
export const holdConstraints = (element: Element, constraints?: Bounds) => {
    const releases = [constraints, elementConstraints.get(element)]
        .filter((bounds, i, all) => bounds && all.indexOf(bounds) === i)
        .map((bounds) => bounds!.hold())

    return () => releases.forEach((release) => release())
}

/**
 * Keep an element within constraints, whatever moves it. Returns the
 * constraints, which `drag()` and `pinch()` can share:
 *
 * ```javascript
 * const bounds = constrain(photo, frame)
 *
 * drag(photo, { constraints: bounds })
 * pinch(photo, { constraints: bounds })
 *
 * // Zoom out, and the photo stays within the frame
 * animate(photo, { scale: 1 })
 * ```
 *
 * While a gesture is active, it applies the constraints itself, with its
 * elastic. Otherwise, a change to the element's `x`, `y`, `scale` or
 * `rotate` that leaves it outside the constraints moves it back inside.
 * An animation on `x` or `y` runs to its end first, after which the
 * element springs back inside.
 *
 * @public
 */
export function constrain(
    elementOrSelector: ElementOrSelector,
    target: ConstraintsTarget,
    { type, transition }: ConstrainOptions = {}
): Constraints {
    const element = resolveElements(elementOrSelector)[0]
    const [scale, rotate, x, y] = getElementValues(element)
    const bounds = createBounds(element, target, type, () => [x.get(), y.get()])

    elementConstraints.get(element)?.stop()
    elementConstraints.set(element, bounds)

    let springBack = false

    /**
     * Spring back with a spring generator of our own, rather than an
     * animation, so constrain() doesn't bundle the animation engine.
     */
    const springs = new Map<MotionValue<number>, VoidFunction>()
    const stopSprings = () => {
        springs.forEach((tick) => cancelFrame(tick))
        springs.clear()
    }

    const springTo = (value: MotionValue<number>, target: number) => {
        const generator = spring({
            keyframes: [toPixels(value.get()), target],
            velocity: value.getVelocity(),
            stiffness: 200,
            damping: 40,
            ...transition,
        })
        const startTime = time.now()
        const tick = () => {
            const { value: latest, done } = generator.next(
                time.now() - startTime
            )
            if (done) {
                cancelFrame(tick)
                springs.delete(value)
            }
            value.set(latest)
        }
        springs.set(value, tick)
        frame.update(tick, true)
    }

    const settle = () => {
        if (bounds.held || springs.size || x.isAnimating() || y.isAnimating()) {
            return
        }

        const { left, right, top, bottom } = bounds.at({
            scale: scale.get(),
            rotate: rotate.get(),
        })

        const limits = [
            [x, left, right],
            [y, top, bottom],
        ] as const

        for (const [value, min = -Infinity, max = Infinity] of limits) {
            const latest = toPixels(value.get())
            const next = clamp(min, max, latest)
            if (next === latest) continue

            springBack ? springTo(value, next) : value.set(next)
        }

        springBack = false
    }

    const schedule = () => frame.preRender(settle)
    const scheduleSpring = () => {
        springBack = true
        schedule()
    }

    bounds.onRelease = scheduleSpring

    /**
     * A gesture takes over from a spring back, as from an animation.
     */
    bounds.onHold = stopSprings

    const remeasure = () => {
        frame.read(bounds.measure)
        schedule()
    }

    const constraint = "current" in target ? target.current : target
    const stops = [
        ...[scale, rotate, x, y].map((value) => value.on("change", schedule)),
        x.on("animationComplete", scheduleSpring),
        y.on("animationComplete", scheduleSpring),
        resize(element, remeasure),
        isElement(constraint) ? resize(constraint, remeasure) : () => {},
    ]

    bounds.stop = () => {
        stopSprings()
        stops.forEach((stop) => stop())
        if (elementConstraints.get(element) === bounds) {
            elementConstraints.delete(element)
        }
    }

    remeasure()

    return bounds
}
