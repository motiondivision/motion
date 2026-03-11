import { useRef } from "react"
import { motion, MotionConfig, correctParentTransform } from "framer-motion"

export const App = () => {
    const ref = useRef<HTMLDivElement>(null)

    return (
        <motion.div
            ref={ref}
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 400,
                height: 400,
                rotate: 180,
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
        </motion.div>
    )
}
