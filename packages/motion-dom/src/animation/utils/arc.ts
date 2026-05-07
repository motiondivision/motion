import type { Path, Point2D } from "../types"

interface ArcOptions {
    /**
     * How far the arc bulges perpendicular to the straight-line path,
     * as a fraction of the total distance. A value of `1` means the arc
     * peaks at a height equal to the full travel distance. Default `0.5`.
     */
    amplitude?: number
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
    orientToPath?: boolean | number
}

function bezierPoint(
    t: number,
    origin: number,
    control: number,
    target: number
): number {
    return (
        Math.pow(1 - t, 2) * origin +
        2 * (1 - t) * t * control +
        Math.pow(t, 2) * target
    )
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

function normalizeAngle(angle: number): number {
    return ((((angle + 180) % 360) + 360) % 360) - 180
}

function computeArcControlPoint(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    amplitude: number,
    peak: number
): { x: number; y: number } {
    const deltaX = toX - fromX
    const deltaY = toY - fromY
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    if (distance > 0) {
        const normalPerpX = -deltaY / distance
        const normalPerpY = deltaX / distance
        const desiredHeight = amplitude * distance

        return {
            x: fromX + deltaX * peak + normalPerpX * desiredHeight,
            y: fromY + deltaY * peak + normalPerpY * desiredHeight,
        }
    }

    return { x: fromX, y: fromY }
}

/**
 * Creates a curved path for use with `transition.path`.
 *
 * ```ts
 * <motion.div
 *   animate={{ x: 200, y: 100 }}
 *   transition={{ path: arc() }}
 * />
 * ```
 *
 * The factory closes over its options and the screen-side of the previous
 * bulge. Reuse `arc(...)` (module scope, useMemo, useRef) if you want
 * that continuity to survive re-renders — fresh `arc()` calls start with
 * no memory.
 */
export function arc({
    amplitude = 0.5,
    peak = 0.5,
    direction,
    orientToPath = false,
}: ArcOptions = {}): Path {
    const rotationScale =
        orientToPath === true ? 1 : typeof orientToPath === "number" ? orientToPath : 0

    // For most chord transitions auto-direction picks the same screen side,
    // so this closure only matters in the dominant-axis-change case
    // (e.g. arc 1 mostly horizontal, arc 2 mostly vertical). When that
    // happens, we flip the signed amplitude so the next arc keeps bulging
    // toward the same screen side as the previous call. Reuse the factory
    // (module scope or useMemo) to keep this closure alive.
    let prevBulgeSign: number | undefined

    return (from: Point2D, to: Point2D) => {
        const dx = to.x - from.x
        const dy = to.y - from.y

        // Pick the sign of `amplitude` so the arc bulges to the desired side.
        let signed: number
        if (direction === "cw") {
            signed = -amplitude
        } else if (direction === "ccw") {
            signed = amplitude
        } else {
            const dom = Math.abs(dx) >= Math.abs(dy) ? dx : dy
            signed = dom < 0 ? -amplitude : amplitude
        }

        let control = computeArcControlPoint(
            from.x,
            from.y,
            to.x,
            to.y,
            signed,
            peak
        )

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

        const tangent0 = rotationScale
            ? bezierTangentAngle(0, from.x, control.x, to.x, from.y, control.y, to.y)
            : 0
        const tangent1 = rotationScale
            ? bezierTangentAngle(1, from.x, control.x, to.x, from.y, control.y, to.y)
            : 0

        return (t: number) => {
            const out: { x: number; y: number; rotate?: number } = {
                x: bezierPoint(t, from.x, control.x, to.x),
                y: bezierPoint(t, from.y, control.y, to.y),
            }
            if (rotationScale) {
                const raw = bezierTangentAngle(
                    t,
                    from.x, control.x, to.x,
                    from.y, control.y, to.y
                )
                const baseline =
                    tangent0 + normalizeAngle(tangent1 - tangent0) * t
                out.rotate =
                    normalizeAngle(raw - baseline) * rotationScale
            }
            return out
        }
    }
}
