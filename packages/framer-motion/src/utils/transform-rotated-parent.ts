import type { Point, TransformPoint } from "motion-utils"
import type { RefObject } from "react"

/**
 * Creates a `transformPagePoint` function that corrects pointer coordinates
 * for a parent container with CSS transforms (rotation, scale, skew).
 *
 * When dragging elements inside a transformed parent, pointer coordinates
 * need to be transformed through the inverse of the parent's transform
 * so the drag offset is in local space.
 *
 * Works with both static and continuously animating transforms.
 *
 * @example
 * ```jsx
 * function App() {
 *   const ref = useRef(null)
 *
 *   return (
 *     <motion.div ref={ref} style={{ rotate: 90 }}>
 *       <MotionConfig transformPagePoint={correctParentTransform(ref)}>
 *         <motion.div drag />
 *       </MotionConfig>
 *     </motion.div>
 *   )
 * }
 * ```
 *
 * @param parentRef - A React ref to the transformed parent element
 * @returns A transformPagePoint function for use with MotionConfig
 *
 * @public
 */
export function correctParentTransform(
    parentRef: RefObject<HTMLElement | null>
): TransformPoint {
    return (point: Point): Point => {
        const parent = parentRef.current
        if (!parent) return point

        const inv = getInverseMatrix(parent)
        if (!inv) return point

        // Get center of rotation in page space
        const rect = parent.getBoundingClientRect()
        const cx = rect.left + window.scrollX + rect.width / 2
        const cy = rect.top + window.scrollY + rect.height / 2

        // Transform (point - center) through inverse, then add center back
        const dx = point.x - cx
        const dy = point.y - cy
        return {
            x: cx + inv.a * dx + inv.c * dy,
            y: cy + inv.b * dx + inv.d * dy,
        }
    }
}

interface InverseMatrix {
    a: number
    b: number
    c: number
    d: number
}

function getInverseMatrix(element: HTMLElement): InverseMatrix | null {
    const { transform } = getComputedStyle(element)
    if (!transform || transform === "none") return null

    const match =
        transform.match(/^matrix3d\((.*)\)$/u) ||
        transform.match(/^matrix\((.*)\)$/u)
    if (!match) return null

    const v = match[1].split(",").map(Number)
    const is3d = transform.startsWith("matrix3d")
    const a = v[0],
        b = v[1]
    const c = is3d ? v[4] : v[2]
    const d = is3d ? v[5] : v[3]

    const det = a * d - b * c
    if (Math.abs(det) < 1e-10) return null

    return { a: d / det, b: -b / det, c: -c / det, d: a / det }
}
