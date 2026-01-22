import { useRef } from "react"
import { motion, MotionConfig, transformViewBoxPoint } from "framer-motion"

/**
 * Test for SVG drag with mismatched viewBox and dimensions.
 *
 * When an SVG has viewBox="0 0 100 100" but width/height="500",
 * dragging should correctly transform pointer coordinates.
 *
 * A mouse movement of 100 pixels in screen space should translate to
 * 20 units in SVG coordinate space (100 * 100/500 = 20).
 */
export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const svgRef = useRef<SVGSVGElement>(null)

    // Default: viewBox is 100x100 but rendered size is 500x500
    // This creates a 5x scale factor
    const viewBoxX = parseFloat(params.get("viewBoxX") || "0")
    const viewBoxY = parseFloat(params.get("viewBoxY") || "0")
    const viewBoxWidth = parseFloat(params.get("viewBoxWidth") || "100")
    const viewBoxHeight = parseFloat(params.get("viewBoxHeight") || "100")
    const svgWidth = parseFloat(params.get("svgWidth") || "500")
    const svgHeight = parseFloat(params.get("svgHeight") || "500")

    return (
        <MotionConfig transformPagePoint={transformViewBoxPoint(svgRef)}>
            <svg
                ref={svgRef}
                viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
                width={svgWidth}
                height={svgHeight}
                style={{ border: "1px solid black" }}
            >
                <motion.rect
                    data-testid="draggable"
                    x={10}
                    y={10}
                    width={20}
                    height={20}
                    fill="red"
                    drag
                    dragElastic={0}
                    dragMomentum={false}
                />
            </svg>
        </MotionConfig>
    )
}
