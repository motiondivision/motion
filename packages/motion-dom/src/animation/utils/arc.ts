import { wrap } from "motion-utils"
import { motionValue } from "../../value"
import { animateMotionValue } from "../interfaces/motion-value"
import type { MotionPath, PathInterpolator, Point2D } from "../types"
import { getValueTransition } from "./get-value-transition"

export interface ArcOptions {
    /**
     * How far the arc bulges perpendicular to the straight-line path,
     * as a fraction of the total distance. A value of `1` means the arc
     * peaks at a height equal to the full travel distance. Default `0.5`.
     */
    amp?: number
    /**
     * Where along the path (0–1) the arc reaches its maximum height.
     * Default `0.5` (symmetric).
     */
    peak?: number
    /**
     * Which side the arc bulges toward.
     * - `"cw"` / `"ccw"` — locked relative to direction of travel
     * - unset — auto-pick a stable screen-space side
     */
    direction?: "cw" | "ccw"
    /**
     * Rotates the element to follow the tangent of the arc path.
     * - `true` — full tangent following (1.0)
     * - number 0–1 — scale factor
     */
    rotate?: boolean | number
}

const MIN_LAYOUT_DISTANCE = 20

function bezierPoint(
    t: number,
    origin: number,
    control: number,
    target: number
): number {
    const inv = 1 - t
    return inv * inv * origin + 2 * inv * t * control + t * t * target
}

function bezierTangentAngle(
    t: number,
    originX: number,
    controlX: number,
    targetX: number,
    originY: number,
    controlY: number,
    targetY: number
): number {
    const dx =
        2 * (1 - t) * (controlX - originX) + 2 * t * (targetX - controlX)
    const dy =
        2 * (1 - t) * (controlY - originY) + 2 * t * (targetY - controlY)
    return Math.atan2(dy, dx) * (180 / Math.PI)
}

function computeArcControlPoint(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    amp: number,
    peak: number
): { x: number; y: number } {
    const deltaX = toX - fromX
    const deltaY = toY - fromY
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    if (distance > 0) {
        const normalPerpX = -deltaY / distance
        const normalPerpY = deltaX / distance
        const desiredHeight = amp * distance

        return {
            x: fromX + deltaX * peak + normalPerpX * desiredHeight,
            y: fromY + deltaY * peak + normalPerpY * desiredHeight,
        }
    }

    return { x: fromX, y: fromY }
}

/**
 * The pure sampling factory: `(from, to) => (t) => point`. Internal —
 * used by {@link arc} and the unit tests. Not part of the public surface.
 */
export function createArcPath({
    amp = 0.5,
    peak = 0.5,
    direction,
    rotate = false,
}: ArcOptions = {}): (from: Point2D, to: Point2D) => PathInterpolator {
    const rotationScale =
        rotate === true ? 1 : typeof rotate === "number" ? rotate : 0

    // Auto-direction only: persists across calls to flip the bulge back
    // onto the same screen side when the dominant axis changes between
    // calls. Reuse the factory (module scope / useMemo) to keep this alive.
    let prevBulgeSign: number | undefined

    const createInterpolator = (
        from: Point2D,
        to: Point2D
    ): PathInterpolator => {
        const dx = to.x - from.x
        const dy = to.y - from.y

        let signed: number
        if (direction === "cw") {
            signed = -amp
        } else if (direction === "ccw") {
            signed = amp
        } else {
            const dom = Math.abs(dx) >= Math.abs(dy) ? dx : dy
            signed = dom < 0 ? -amp : amp
        }

        let control = computeArcControlPoint(
            from.x,
            from.y,
            to.x,
            to.y,
            signed,
            peak
        )

        if (direction === undefined) {
            const isVertical = Math.abs(dx) < Math.abs(dy)
            const midX = from.x + dx * peak
            const midY = from.y + dy * peak
            const bulgeSign = isVertical
                ? Math.sign(control.x - midX)
                : Math.sign(control.y - midY)

            if (
                prevBulgeSign !== undefined &&
                bulgeSign !== 0 &&
                bulgeSign !== prevBulgeSign
            ) {
                signed = -signed
                control = computeArcControlPoint(
                    from.x,
                    from.y,
                    to.x,
                    to.y,
                    signed,
                    peak
                )
            } else if (bulgeSign !== 0) {
                prevBulgeSign = bulgeSign
            }
        }

        const tangent0 = rotationScale
            ? bezierTangentAngle(
                  0,
                  from.x,
                  control.x,
                  to.x,
                  from.y,
                  control.y,
                  to.y
              )
            : 0
        const tangent1 = rotationScale
            ? bezierTangentAngle(
                  1,
                  from.x,
                  control.x,
                  to.x,
                  from.y,
                  control.y,
                  to.y
              )
            : 0
        const tangentDelta = rotationScale
            ? wrap(-180, 180, tangent1 - tangent0)
            : 0

        return (t: number) => {
            const out: { x: number; y: number; rotate?: number } = {
                x: bezierPoint(t, from.x, control.x, to.x),
                y: bezierPoint(t, from.y, control.y, to.y),
            }
            if (rotationScale) {
                const raw = bezierTangentAngle(
                    t,
                    from.x,
                    control.x,
                    to.x,
                    from.y,
                    control.y,
                    to.y
                )
                const baseline = tangent0 + tangentDelta * t
                out.rotate = wrap(-180, 180, raw - baseline) * rotationScale
            }
            return out
        }
    }

    return createInterpolator
}

/**
 * Creates a curved path for `transition.path`:
 *
 * ```ts
 * <motion.div animate={{ x: 200, y: 100 }} transition={{ path: arc() }} />
 * ```
 *
 * Reuse the returned value (module scope / useMemo / useRef) so its
 * continuity closure survives re-renders — a fresh `arc()` has no memory.
 */
export function arc(options: ArcOptions = {}): MotionPath {
    const sample = createArcPath(options)

    const path: MotionPath = {
        interpolateProjection(delta) {
            // `from` is the current translate offset (carries any in-flight
            // displacement when interrupted); `to` is the new layout origin.
            // The distance floor avoids visible wobble on tiny shifts.
            const tx = delta.x.translate
            const ty = delta.y.translate
            if (Math.sqrt(tx * tx + ty * ty) < MIN_LAYOUT_DISTANCE) {
                return undefined
            }
            return sample({ x: tx, y: ty }, { x: 0, y: 0 })
        },

        animateVisualElement(
            visualElement,
            target,
            transition,
            delay,
            animations
        ) {
            if (!("x" in target || "y" in target)) return

            const xValue = visualElement.getValue(
                "x",
                visualElement.latestValues["x"] ?? 0
            )
            const yValue = visualElement.getValue(
                "y",
                visualElement.latestValues["y"] ?? 0
            )

            const xRaw = target.x as number | number[] | undefined
            const yRaw = target.y as number | number[] | undefined

            const xFrom = ((Array.isArray(xRaw) && xRaw[0] != null
                ? xRaw[0]
                : xValue?.get()) as number) ?? 0
            const yFrom = ((Array.isArray(yRaw) && yRaw[0] != null
                ? yRaw[0]
                : yValue?.get()) as number) ?? 0
            const xTo = (Array.isArray(xRaw)
                ? xRaw[xRaw.length - 1]
                : xRaw ?? xFrom) as number
            const yTo = (Array.isArray(yRaw)
                ? yRaw[yRaw.length - 1]
                : yRaw ?? yFrom) as number

            // Interruption needs no flag: x/y already hold the displaced
            // mid-arc position, so xFrom/yFrom carry the continuity geometry.
            const interpolate = sample(
                { x: xFrom, y: yFrom },
                { x: xTo, y: yTo }
            )

            // Drive a dedicated `pathRotation` value (composed onto `rotate`
            // at the build sites) rather than `rotate` itself, so a
            // concurrent rotate animation composes and nothing accumulates
            // on interrupt.
            const pathRotationValue =
                interpolate(0).rotate !== undefined
                    ? visualElement.getValue("pathRotation", 0)
                    : undefined

            const pathTransition = {
                delay,
                ...getValueTransition(transition || {}, "x"),
            }
            delete (pathTransition as { path?: unknown }).path

            const progress = motionValue(0)
            progress.start(
                animateMotionValue("", progress, [0, 1000] as any, {
                    ...pathTransition,
                    isSync: true,
                    velocity: 0,
                    onUpdate: (latest: number) => {
                        const point = interpolate(latest / 1000)
                        xValue?.set(point.x)
                        yValue?.set(point.y)
                        if (pathRotationValue && point.rotate !== undefined) {
                            pathRotationValue.set(point.rotate)
                        }
                    },
                    onComplete: () => {
                        xValue?.set(xTo)
                        yValue?.set(yTo)
                        pathRotationValue?.set(0)
                    },
                    // Interrupt/cancel must clear our additive contribution
                    // so it can't linger on top of the user's `rotate`.
                    onStop: () => pathRotationValue?.set(0),
                    onCancel: () => pathRotationValue?.set(0),
                })
            )

            if (progress.animation) animations.push(progress.animation)

            delete (target as { x?: unknown }).x
            delete (target as { y?: unknown }).y
        },
    }

    return path
}
