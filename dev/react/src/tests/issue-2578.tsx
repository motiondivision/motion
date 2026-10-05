import { motion, useMotionValue } from "framer-motion"

/**
 * Reproduction from issue #2578: a MotionValue rendered as the child of an
 * SVG <motion.text> doesn't update the text content.
 */
export const App = () => {
    const count = useMotionValue(0)

    return (
        <>
            <button id="set" onClick={() => count.set(100)}>
                Set
            </button>
            <svg width={200} height={100}>
                <motion.text id="svg-text" x={10} y={50}>
                    {count}
                </motion.text>
            </svg>
            <motion.h1 id="html-text">{count}</motion.h1>
        </>
    )
}
