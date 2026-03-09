import { useRef } from "react"
import { motion, MotionConfig, correctParentTransform } from "framer-motion"

/**
 * Reproduction for #3132: drag inside a parent with transform: scale()
 * Uses correctParentTransform to compensate for the parent's scale.
 */
export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const scale = parseFloat(params.get("scale") || "0.5")
    const ref = useRef<HTMLDivElement>(null)

    return (
        <div
            ref={ref}
            id="container"
            style={{
                width: 800,
                height: 800,
                background: "blue",
                transform: `scale(${scale})`,
                transformOrigin: "top left",
            }}
        >
            <MotionConfig transformPagePoint={correctParentTransform(ref)}>
                <motion.div
                    data-testid="draggable"
                    drag
                    dragElastic={0}
                    dragMomentum={false}
                    style={{
                        width: 100,
                        height: 100,
                        background: "red",
                    }}
                />
            </MotionConfig>
        </div>
    )
}
