import { motion } from "framer-motion"

/**
 * https://github.com/motiondivision/motion/issues/1831
 *
 * A draggable slide (based on the image-gallery example) whose animate prop
 * is a list of variant labels. Every onAnimationComplete call is logged to
 * window.completed so the spec can check whether releasing the drag fires it.
 */
const variants = {
    base: { x: 300, opacity: 0 },
    exiting: { x: -300, opacity: 0 },
    center: { x: 0, opacity: 1 },
}

declare global {
    interface Window {
        completed: string[]
    }
}

window.completed = []

export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const single = params.get("single") === "true"
    const animate = single ? "center" : ["base", "exiting", "center"]

    return (
        <motion.div
            id="box"
            variants={variants}
            initial="base"
            animate={animate}
            transition={{ duration: 0.2 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onAnimationComplete={(definition) => {
                window.completed.push(String(definition))
            }}
            style={{
                position: "absolute",
                top: 100,
                left: 200,
                width: 200,
                height: 200,
                background: "red",
            }}
        />
    )
}
