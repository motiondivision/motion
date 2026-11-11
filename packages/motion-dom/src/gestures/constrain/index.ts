import type { BoundingBox } from "motion-utils"
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
     * Which box element constraints keep within the constraining element.
     * Defaults to `"visual"`.
     */
    type?: ConstraintsType
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
 * The constraints an element's gestures share. Setting constraints on
 * `drag()` or `pinch()` (or calling `constrain()`) replaces them, so the
 * last one set applies to both gestures.
 */
export interface ElementConstraints {
    /**
     * What set them: a gesture recognises its own.
     */
    owner: unknown
    target: unknown
    type: ConstraintsType
    bounds?: Constraints
}

export const elementConstraints = new WeakMap<Element, ElementConstraints>()

/**
 * The scale and rotation a pinch is settling at, by element, so a drag
 * released mid-settle aims for the limits it will end up with.
 */
export const settleTransforms = new WeakMap<Element, ConstraintsTransform>()

/**
 * An element's `x`/`y` limits at a scale and rotation, as axes.
 */
export const axesAt = (
    bounds: Constraints,
    transform: Partial<ConstraintsTransform>
) => {
    const { left, right, top, bottom } = bounds.at(transform)
    return [
        { min: left, max: right },
        { min: top, max: bottom },
    ]
}

export const setElementConstraints = (
    element: Element,
    owner: unknown,
    target: unknown,
    type: ConstraintsType,
    bounds?: Constraints
) => elementConstraints.set(element, { owner, target, type, bounds })

/**
 * Remove an element's constraints, if `owner` set them.
 */
export const removeElementConstraints = (element: Element, owner: unknown) =>
    elementConstraints.get(element)?.owner === owner &&
    elementConstraints.delete(element)

export const isConstraints = (value: unknown): value is Constraints =>
    !!value && typeof value === "object" && "at" in value

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
): Constraints {
    let width = 0
    let height = 0
    let centreX = 0
    let centreY = 0
    let frameBox: DOMRect | undefined

    const resolveTarget = () =>
        target && "current" in target ? target.current : target

    const bounds: Constraints = {
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
    }

    return bounds
}

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
 * Constraints only apply to gestures: `animate()` can still move the
 * element outside them.
 *
 * @public
 */
export function constrain(
    elementOrSelector: ElementOrSelector,
    target: ConstraintsTarget,
    { type = "visual" }: ConstrainOptions = {}
): Constraints {
    const element = resolveElements(elementOrSelector)[0]
    const bounds = createBounds(element, target, type, () => {
        const [, , x, y] = getElementValues(element)
        return [x.get(), y.get()]
    })

    setElementConstraints(element, bounds, target, type, bounds)

    return bounds
}
