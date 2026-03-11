import { useRef } from "react"
import { motion, MotionConfig, transformViewBoxPoint } from "framer-motion"

/**
 * Example demonstrating SVG drag with mismatched viewBox and dimensions.
 *
 * This example shows how to use `transformViewBoxPoint` to correctly
 * handle drag within an SVG where the viewBox coordinates differ from
 * the rendered pixel dimensions.
 *
 * Without transformViewBoxPoint, dragging would move the element 5x
 * faster than expected because the viewBox is 100x100 but rendered at 500x500.
 */
export const App = () => {
    const svgRef = useRef<SVGSVGElement>(null)

    return (
        <MotionConfig transformPagePoint={transformViewBoxPoint(svgRef)}>
            <svg
                ref={svgRef}
                viewBox="0 0 100 100"
                style={{
                    width: 500,
                    height: 500,
                    border: "2px solid white",
                    borderRadius: 20,
                }}
            >
                <motion.circle
                    cx={50}
                    cy={50}
                    r={10}
                    fill="white"
                    drag
                    dragConstraints={{
                        left: -40,
                        right: 40,
                        top: -40,
                        bottom: 40,
                    }}
                    dragElastic={0.1}
                />
            </svg>
        </MotionConfig>
    )
}
