import { motion } from "framer-motion"

/**
 * Layout animations and transformTemplate compose the transform shorthand
 * themselves, so these must stay on the main thread. rotate with an
 * infinite repeat stays accelerated.
 */
export const App = () => {
    const transition = { type: "tween", ease: "linear", duration: 10 } as const

    return (
        <>
            <motion.div
                id="layout"
                layout
                initial={{ x: 0 }}
                animate={{ x: 100 }}
                transition={transition}
                style={{ width: 100, height: 100, background: "red" }}
            />
            <motion.div
                id="template"
                initial={{ x: 0 }}
                animate={{ x: 100 }}
                transition={transition}
                transformTemplate={(_, generated) =>
                    `${generated} skewX(10deg)`
                }
                style={{ width: 100, height: 100, background: "blue" }}
            />
            <motion.div
                id="perspective"
                initial={{ x: 0, transformPerspective: 500 }}
                animate={{ x: 100 }}
                transition={transition}
                style={{ width: 100, height: 100, background: "green" }}
            />
            <motion.div
                id="repeat"
                initial={{ rotate: 0 }}
                animate={{ rotate: 360 }}
                transition={{
                    ease: "linear",
                    duration: 1,
                    repeat: Infinity,
                    repeatType: "reverse",
                }}
                style={{ width: 100, height: 100, background: "yellow" }}
            />
        </>
    )
}
