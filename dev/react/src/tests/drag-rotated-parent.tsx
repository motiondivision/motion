import { motion } from "framer-motion"

/**
 * Test for drag behavior when the draggable element has a rotated parent.
 * Issue: https://github.com/motiondivision/motion/issues/3320
 *
 * When a parent element is rotated 180 degrees, dragging the child element
 * should move it in the expected direction (following the mouse), not inverted.
 */
export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const rotate = parseFloat(params.get("rotate") || "0")

    return (
        <motion.div
            id="rotated-parent"
            data-testid="rotated-parent"
            style={{
                width: 300,
                height: 300,
                background: "#eee",
                rotate,
                transformOrigin: "center center",
                position: "absolute",
                top: 100,
                left: 100,
            }}
        >
            <motion.div
                id="draggable"
                data-testid="draggable"
                drag
                dragElastic={0}
                dragMomentum={false}
                style={{
                    width: 50,
                    height: 50,
                    background: "red",
                }}
            />
        </motion.div>
    )
}
