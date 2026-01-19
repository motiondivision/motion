import type { RefObject } from "react"
import type { Point, TransformPoint } from "motion-utils"

/**
 * Creates a `transformPagePoint` function that accounts for SVG viewBox scaling.
 *
 * When dragging SVG elements inside an SVG with a viewBox that differs from
 * the rendered dimensions (e.g., `viewBox="0 0 100 100"` but rendered at 500x500 pixels),
 * pointer coordinates need to be transformed to match the SVG's coordinate system.
 *
 * @example
 * ```jsx
 * function App() {
 *   const svgRef = useRef<SVGSVGElement>(null)
 *
 *   return (
 *     <MotionConfig transformPagePoint={transformViewBoxPoint(svgRef)}>
 *       <svg ref={svgRef} viewBox="0 0 100 100" width={500} height={500}>
 *         <motion.rect drag width={10} height={10} />
 *       </svg>
 *     </MotionConfig>
 *   )
 * }
 * ```
 *
 * @param svgRef - A React ref to the SVG element
 * @returns A transformPagePoint function for use with MotionConfig
 *
 * @public
 */
export function transformViewBoxPoint(
    svgRef: RefObject<SVGSVGElement | null>
): TransformPoint {
    return (point: Point): Point => {
        const svg = svgRef.current
        if (!svg) {
            return point
        }

        // Get the viewBox attribute
        const viewBox = svg.viewBox?.baseVal
        if (!viewBox || (viewBox.width === 0 && viewBox.height === 0)) {
            // No viewBox or empty viewBox - no transformation needed
            return point
        }

        // Get the rendered dimensions of the SVG
        const bbox = svg.getBoundingClientRect()
        if (bbox.width === 0 || bbox.height === 0) {
            return point
        }

        // Calculate scale factors
        const scaleX = viewBox.width / bbox.width
        const scaleY = viewBox.height / bbox.height

        // Get the SVG's position on the page
        const svgX = bbox.left + window.scrollX
        const svgY = bbox.top + window.scrollY

        // Transform the point:
        // 1. Calculate position relative to SVG
        // 2. Scale by viewBox/viewport ratio
        // 3. Add back the SVG position (but in SVG coordinates)
        return {
            x: (point.x - svgX) * scaleX + svgX,
            y: (point.y - svgY) * scaleY + svgY,
        }
    }
}
