import { motion } from "framer-motion"
import { useRef } from "react"

export const App = () => {
    const constraintsRef = useRef(null)
    const params = new URLSearchParams(window.location.search)
    const layout = params.get("layout") || undefined

    return (
        <motion.div
            id="constraints"
            ref={constraintsRef}
            style={{
                width: 300,
                height: 300,
                background: "rgba(0, 0, 255, 0.2)",
            }}
        >
            <motion.div
                id="box"
                data-testid="draggable"
                drag
                dragConstraints={constraintsRef}
                dragElastic={1}
                dragMomentum={false}
                layout={layout}
                style={{
                    width: 100,
                    height: 100,
                    background: "red",
                }}
            />
        </motion.div>
    )
}
