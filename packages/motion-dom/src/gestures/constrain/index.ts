import type { Axis, BoundingBox, Point } from "motion-utils"
import type { Transition } from "../../animation/types"
import { eachAxis } from "../../projection/utils/each-axis"
import type { VisualElement } from "../../render/VisualElement"
import type { MotionValue } from "../../value"
import type { MotionNodeOptions } from "../../node/types"
import type { ResolvedConstraints, ResolvedElastic } from "../drag/types"
import { applyConstraints } from "../drag/utils/constraints"
import {
    resolveElements,
    type ElementOrSelector,
} from "../../utils/resolve-elements"
import { getElementValues } from "../utils/element-values"
import {
    constraintsHooks,
    elementConstraints,
    removeElementConstraints,
    setElementConstraints,
} from "./store"

export {
    elementConstraints,
    removeElementConstraints,
    setElementConstraints,
} from "./store"
export type { ElementConstraints } from "./store"

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
     * Which box element constraints keep within the constraining element.
     * Defaults to `"visual"`.
     */
    type?: ConstraintsType

    /**
     * Where to hold the element along an axis where it's smaller than the
     * constraining element, from `0` (the start edge) to `1` (the end
     * edge). For example, `0.5` keeps a photo narrower than its frame
     * centred, instead of free to move within it. By default, it can move
     * anywhere inside.
     */
    align?: number | ConstraintsAlign
}

/**
 * @public
 */
export interface ConstraintsAlign {
    x?: number
    y?: number
}

/**
 * Constraints measured for an element.
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
     * Measure the element and the constraining element again. Gestures
     * call this as they start.
     */
    measure(): void
}

/**
 * The scale and rotation a pinch is settling at, by element, so a drag
 * released mid-settle aims for the limits it will end up with.
 */
export const settleTransforms = new WeakMap<Element, ConstraintsTransform>()

export const isConstraints = (value: unknown): value is Bounds =>
    !!value && typeof value === "object" && "region" in value

export const isElement = (value: unknown): value is Element =>
    !!value && typeof value === "object" && "getBoundingClientRect" in value

const toPixels = (value: unknown) => parseFloat(value as string) || 0

/**
 * The limits along one axis that keep a box of half-length `half`, whose
 * layout centre is at `centre`, between `min` and `max`. If the box is
 * longer than the space, they flip, so it covers the space instead. If
 * it's shorter and `align` is set, it's held at that point between them.
 */
const axisLimits = (
    min: number,
    max: number,
    half: number,
    centre: number,
    align?: number
) => {
    const a = min + half - centre
    const b = max - half - centre
    if (a > b) return [b, a]
    if (align === undefined) return [a, b]
    const held = a + (b - a) * align
    return [held, held]
}

/**
 * Limits along two perpendicular axes: `x` along (cos, sin) and `y`
 * along (-sin, cos). Usually these are the page's x and y axes, but a
 * rotated element covering its frame is limited along its own axes.
 */
export interface ConstraintsRegion {
    cos: number
    sin: number
    x: Partial<Axis>
    y: Partial<Axis>
}

/**
 * The parts of a drag that constraints following the element's scale and
 * rotation read and set. They live here, rather than in the drag, so only
 * apps that use them include them.
 */
export interface DragHost {
    visualElement: VisualElement
    constraints: ResolvedConstraints | false
    elastic: ResolvedElastic
    originPoint: Point
    currentDirection: "x" | "y" | null
    point?: unknown
    readProps(): MotionNodeOptions
    getAxisMotionValue(axis: "x" | "y"): MotionValue<number>
    startAxisValueAnimation(
        axis: "x" | "y",
        transition: Transition,
        target?: number
    ): Promise<void>
}

/**
 * Constraints with the internals gestures use.
 */
export interface Bounds extends Constraints {
    /**
     * Set a drag's constraints to the limits at the element's latest
     * scale and rotation, or on release, those a pinch is settling at.
     * Measures first if `measure` is set.
     */
    limit(drag: DragHost, isRelease?: boolean, measure?: boolean): true

    /**
     * Follow the scale (pinch can change it mid-drag) and move the drag
     * within the limits. A rotated element covering its frame is limited
     * along its own axes, so both axes are constrained together. Returns
     * whether it moved the element: a point constraint moves it itself.
     */
    drag(drag: DragHost, offset: Point): boolean

    /**
     * Set the limits for a drag's release. Limits along a rotated
     * element's own axes aren't a box on x/y, which inertia needs, so
     * spring to where momentum would carry it, inside them, instead.
     * Returns that animation, or nothing when inertia can run.
     */
    release(
        drag: DragHost,
        velocity: (axis: "x" | "y") => number,
        snapToOrigin?: unknown
    ): Promise<unknown> | undefined

    region(transform: Partial<ConstraintsTransform>): ConstraintsRegion

    /**
     * Apply the limits, and elastic past them, to a point.
     */
    constrain(
        point: Point,
        transform: Partial<ConstraintsTransform>,
        elastic?: ResolvedElastic
    ): Point

    /**
     * Where a point shown with elastic would be without it.
     */
    /**
     * These constraints for `element`. Constraints created without an
     * element create a copy for each element a gesture uses them on.
     */
    bind(element: Element, getXY: () => [unknown, unknown]): Bounds

    unconstrain(
        point: Point,
        transform: Partial<ConstraintsTransform>,
        elastic: ResolvedElastic
    ): Point
}

const toRegion = ({
    left,
    right,
    top,
    bottom,
}: Partial<BoundingBox>): ConstraintsRegion => ({
    cos: 1,
    sin: 0,
    x: { min: left, max: right },
    y: { min: top, max: bottom },
})

/**
 * Map a point onto the region's axes, apply `fn` to each, and map it back.
 */
const alongRegion = (
    { cos, sin, x, y }: ConstraintsRegion,
    point: Point,
    fn: (value: number, limits: Partial<Axis>, axis: "x" | "y") => number
): Point => {
    const p = fn(point.x * cos + point.y * sin, x, "x")
    const q = fn(point.y * cos - point.x * sin, y, "y")
    return { x: p * cos - q * sin, y: p * sin + q * cos }
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
    element: Element | undefined,
    target: ConstraintsTarget,
    type: ConstraintsType = "visual",
    getXY: () => [unknown, unknown],
    align?: number | ConstraintsAlign
): Bounds {
    const { x: alignX, y: alignY } =
        typeof align === "number" ? { x: align, y: align } : align || {}
    let width = 0
    let height = 0
    let centreX = 0
    let centreY = 0
    let frameBox: DOMRect | undefined

    const resolveTarget = () =>
        target && "current" in target ? target.current : target

    /**
     * Without an element, the constraints a gesture last bound.
     */
    let bound: Bounds | undefined

    /**
     * The element's scale and rotation. On release, those a pinch is
     * settling at, rather than those it's passing through.
     */
    const transformOf = (
        { visualElement }: DragHost,
        isRelease?: boolean
    ): ConstraintsTransform =>
        (isRelease &&
            settleTransforms.get(visualElement.current as Element)) || {
            scale: visualElement.getValue("scale", 1).get(),
            rotate: visualElement.getValue("rotate", 0).get(),
        }

    /**
     * Whether a drag moves along an axis, as drag decides it.
     */
    const moves = (drag: DragHost, axis: "x" | "y") => {
        const allowed = drag.readProps().drag
        const { currentDirection } = drag
        return (
            (allowed === true || allowed === axis) &&
            (currentDirection === null || currentDirection === axis)
        )
    }

    const bounds: Bounds = {
        limit(drag, isRelease, measure) {
            measure && bounds.measure()
            const { left, right, top, bottom } = bounds.at(
                transformOf(drag, isRelease)
            )
            drag.constraints = {
                x: { min: left, max: right },
                y: { min: top, max: bottom },
            }
            return true
        },
        drag(drag, offset) {
            bounds.limit(drag)
            if (drag.point) return false

            const point = { x: 0, y: 0 }
            eachAxis((axis) => {
                point[axis] = moves(drag, axis)
                    ? drag.originPoint[axis] + offset[axis]
                    : drag.getAxisMotionValue(axis).get()
            })
            const shown = bounds.constrain(
                point,
                transformOf(drag),
                drag.elastic
            )
            eachAxis((axis) => drag.getAxisMotionValue(axis).set(shown[axis]))
            return true
        },
        release(drag, velocity, snapToOrigin) {
            const transform = transformOf(drag, true)
            if (snapToOrigin || !bounds.region(transform).sin) {
                bounds.limit(drag, true)
                return
            }

            const point = { x: 0, y: 0 }
            eachAxis((axis) => {
                point[axis] =
                    drag.getAxisMotionValue(axis).get() + 0.2 * velocity(axis)
            })
            const target = bounds.constrain(point, transform)

            return Promise.all(
                eachAxis((axis) =>
                    drag.startAxisValueAnimation(
                        axis,
                        {
                            type: "spring",
                            stiffness: 200,
                            damping: 40,
                            restDelta: 1,
                            restSpeed: 10,
                            velocity: velocity(axis),
                        },
                        target[axis]
                    )
                )
            )
        },
        bind(el, xy) {
            return element
                ? bounds
                : (bound = createBounds(el, target, type, xy, align))
        },
        measure() {
            if (!element) return bound?.measure()

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
        region({ scale = 1, rotate = 0 }) {
            const constraint = resolveTarget()

            if (typeof constraint === "function") {
                return toRegion(constraint({ scale, rotate }))
            }

            if (!isElement(constraint)) return toRegion(constraint || {})
            if (!element)
                return bound ? bound.region({ scale, rotate }) : toRegion({})

            frameBox || bounds.measure()
            if (!frameBox) return toRegion({})

            const visual = type === "visual"
            const s = visual ? scale : 1
            const angle = visual ? (rotate * Math.PI) / 180 : 0
            const cos = Math.cos(angle)
            const sin = Math.sin(angle)
            const absCos = Math.abs(cos)
            const absSin = Math.abs(sin)

            /**
             * Half the size of the box around the scaled, rotated element.
             */
            const halfX = ((width * absCos + height * absSin) * s) / 2
            const halfY = ((width * absSin + height * absCos) * s) / 2
            const { left, right, top, bottom } = frameBox

            /**
             * A rotated element larger than its frame covers it when all
             * four of the frame's corners are inside it: limits along
             * the element's own axes. If it's too small to cover the frame
             * at this angle, it's centred along that axis.
             */
            if (
                absSin > 1e-6 &&
                absCos > 1e-6 &&
                2 * halfX >= right - left &&
                2 * halfY >= bottom - top
            ) {
                const along = (u: number, v: number, half: number) => {
                    const projections = [
                        [left, top],
                        [right, top],
                        [left, bottom],
                        [right, bottom],
                    ].map(([px, py]) => (px - centreX) * u + (py - centreY) * v)
                    let min = Math.max(...projections) - half
                    let max = Math.min(...projections) + half
                    if (min > max) min = max = (min + max) / 2
                    return { min, max }
                }

                return {
                    cos,
                    sin,
                    x: along(cos, sin, (width * s) / 2),
                    y: along(-sin, cos, (height * s) / 2),
                }
            }

            const [l, r] = axisLimits(left, right, halfX, centreX, alignX)
            const [t, b] = axisLimits(top, bottom, halfY, centreY, alignY)

            return toRegion({ left: l, right: r, top: t, bottom: b })
        },
        at(transform = {}) {
            const region = bounds.region(transform)
            const { cos, sin, x, y } = region
            if (!sin) {
                return { left: x.min, right: x.max, top: y.min, bottom: y.max }
            }

            /**
             * The box around a rotated region.
             */
            const corners = [x.min!, x.max!].flatMap((p) =>
                [y.min!, y.max!].map((q) => ({
                    x: p * cos - q * sin,
                    y: p * sin + q * cos,
                }))
            )
            const xs = corners.map((c) => c.x)
            const ys = corners.map((c) => c.y)

            return {
                left: Math.min(...xs),
                right: Math.max(...xs),
                top: Math.min(...ys),
                bottom: Math.max(...ys),
            }
        },
        constrain(point, transform, elastic) {
            return alongRegion(
                bounds.region(transform),
                point,
                (v, limits, axis) =>
                    applyConstraints(v, limits, elastic?.[axis])
            )
        },
        unconstrain(point, transform, elastic) {
            return alongRegion(
                bounds.region(transform),
                point,
                (v, limits, axis) => {
                    const { min = -Infinity, max = Infinity } = limits
                    const limit = Math.min(max, Math.max(min, v))
                    const e = elastic[axis][v < limit ? "min" : "max"]
                    return e ? limit + (v - limit) / e : v
                }
            )
        },
    }

    return bounds
}

/**
 * Whether `constrain()`'s second argument is its options, so it was called
 * without an element. Elements are checked first, as a <div> has `align`.
 */
const isOptions = (value: unknown) =>
    value === undefined ||
    (!!value &&
        typeof value === "object" &&
        !isElement(value) &&
        ("type" in value || "align" in value))

/**
 * Set the constraints of an element's `drag()` and `pinch()` gestures in
 * one call. It's a shortcut for setting `constraints` on both, and like
 * those, replaces constraints set before. Returns the constraints:
 *
 * ```javascript
 * const bounds = constrain(photo, frame)
 *
 * drag(photo)
 * pinch(photo, { scale: { min: 1, max: 4 } })
 *
 * // Where a double-tap zoom to 2.5x can move the photo to
 * bounds.at({ scale: 2.5 })
 * ```
 *
 * Without an element, it creates constraints to pass to a gesture's
 * `constraints` (or React's `dragConstraints`). Each element a gesture
 * uses them on is measured separately:
 *
 * ```jsx
 * const bounds = useMemo(() => constrain(frameRef, { align: 0.5 }), [])
 *
 * <motion.img drag pinch dragConstraints={bounds} />
 * ```
 *
 * Constraints only apply to gestures: `animate()` can still move the
 * element outside them.
 *
 * @public
 */
export function constrain(
    target: ConstraintsTarget,
    options?: ConstrainOptions
): Constraints
export function constrain(
    elementOrSelector: ElementOrSelector,
    target: ConstraintsTarget,
    options?: ConstrainOptions
): Constraints
export function constrain(
    elementOrTarget: ElementOrSelector | ConstraintsTarget,
    targetOrOptions?: ConstraintsTarget | ConstrainOptions,
    options?: ConstrainOptions
): Constraints {
    if (isOptions(targetOrOptions)) {
        const { type = "visual", align } =
            (targetOrOptions as ConstrainOptions) || {}
        return createBounds(
            undefined,
            elementOrTarget as ConstraintsTarget,
            type,
            () => [0, 0],
            align
        )
    }

    const { type = "visual", align } = options || {}
    const element = resolveElements(elementOrTarget as ElementOrSelector)[0]
    const target = targetOrOptions as ConstraintsTarget
    const bounds = createBounds(
        element,
        target,
        type,
        () => {
            const [, , x, y] = getElementValues(element)
            return [x.get(), y.get()]
        },
        align
    )

    setElementConstraints(element, bounds, target, type, bounds)

    return bounds
}

/**
 * Share a drag's `dragConstraints` as the element's constraints when they
 * change, replacing any pinch() or constrain() set before.
 */
/**
 * A drag's constraints, after sharing its own if they've changed.
 */
constraintsHooks.get = (drag) => {
    constraintsHooks.sync!(drag)
    const element = drag.visualElement.current
    return element && elementConstraints.get(element)?.bounds
}

constraintsHooks.remove = (drag) =>
    removeElementConstraints(drag.visualElement.current, drag)

constraintsHooks.sync = (drag) => {
    const { dragConstraints } = drag.readProps()
    if (dragConstraints === drag.ownConstraints) return
    drag.ownConstraints = dragConstraints

    // A point constraint only applies to drag
    if (dragConstraints && typeof dragConstraints !== "function") {
        const element = drag.visualElement.current
        setElementConstraints(
            element,
            drag,
            dragConstraints,
            "layout",
            isConstraints(dragConstraints)
                ? dragConstraints.bind(element, () => [
                      drag.getAxisMotionValue("x").get(),
                      drag.getAxisMotionValue("y").get(),
                  ])
                : undefined
        )
    }
}
