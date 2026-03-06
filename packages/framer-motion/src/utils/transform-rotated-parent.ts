import type { Point, TransformPoint } from "motion-utils"
import type { RefObject } from "react"

/**
 * Creates a `transformPagePoint` function that corrects pointer coordinates
 * for a rotated/scaled parent container.
 *
 * When dragging elements inside a parent that has CSS rotation or scale,
 * pointer coordinates need to be transformed through the inverse of the
 * parent's rotation/scale matrix so the drag offset is in local space.
 *
 * @example
 * ```jsx
 * function App() {
 *   const ref = useRef(null)
 *
 *   return (
 *     <motion.div ref={ref} style={{ rotate: 90 }}>
 *       <MotionConfig transformPagePoint={transformRotatedParent(ref)}>
 *         <motion.div drag />
 *       </MotionConfig>
 *     </motion.div>
 *   )
 * }
 * ```
 *
 * @param parentRef - A React ref to the rotated/scaled parent element
 * @returns A transformPagePoint function for use with MotionConfig
 *
 * @public
 */
export function transformRotatedParent(
    parentRef: RefObject<HTMLElement | null>
): TransformPoint {
    return (point: Point): Point => {
        const parent = parentRef.current
        if (!parent) return point

        const { transform } = getComputedStyle(parent)
        if (!transform || transform === "none") return point

        // Parse matrix(a,b,c,d,tx,ty) or matrix3d(...)
        const match =
            transform.match(/^matrix3d\((.*)\)$/u) ||
            transform.match(/^matrix\((.*)\)$/u)
        if (!match) return point

        const v = match[1].split(",").map(Number)
        const is3d = transform.startsWith("matrix3d")
        const a = v[0],
            b = v[1]
        const c = is3d ? v[4] : v[2]
        const d = is3d ? v[5] : v[3]

        // Invert the 2×2 linear part (rotation + scale)
        const det = a * d - b * c
        if (Math.abs(det) < 1e-10) return point

        const ia = d / det,
            ib = -b / det
        const ic = -c / det,
            id = a / det

        return {
            x: ia * point.x + ic * point.y,
            y: ib * point.x + id * point.y,
        }
    }
}
