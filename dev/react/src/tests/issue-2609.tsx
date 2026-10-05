import { motion } from "framer-motion"

/**
 * #2609: scaleZ set via initial/animate is not applied to the element.
 */
export const App = () => (
    <div style={{ perspective: 500 }}>
        <motion.div
            id="box"
            initial={{ scaleZ: 1, rotateX: 0 }}
            animate={{ scaleZ: 2, rotateX: 45 }}
            transition={{ duration: 0 }}
            style={{
                width: 100,
                height: 100,
                background: "red",
                transformStyle: "preserve-3d",
            }}
        />
        <motion.div
            id="static"
            style={{ scaleZ: 3, width: 100, height: 100, background: "blue" }}
        />
    </div>
)
