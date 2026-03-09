import { useRef } from "react"
import { motion, MotionConfig, transformRotatedParent } from "framer-motion"

export const App = () => {
    const ref = useRef<HTMLDivElement>(null)

    return (
        <div
            style={{
                width: "100vw",
                height: "100vh",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                background: "#111",
            }}
        >
            <motion.div
                ref={ref}
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                style={{
                    width: 300,
                    height: 300,
                    background: "#333",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    borderRadius: 20,
                    border: "2px solid #555",
                }}
            >
                <MotionConfig transformPagePoint={transformRotatedParent(ref)}>
                    <motion.div
                        drag
                        dragElastic={0.2}
                        dragSnapToOrigin
                        whileDrag={{ scale: 1.1 }}
                        style={{
                            width: 80,
                            height: 80,
                            background: "white",
                            borderRadius: 12,
                            cursor: "grab",
                        }}
                    />
                </MotionConfig>
            </motion.div>
        </div>
    )
}
