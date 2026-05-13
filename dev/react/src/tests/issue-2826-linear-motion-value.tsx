import { animate, motion, useMotionValue } from "framer-motion"
import { useEffect } from "react"

/**
 * Reproduces the scenario from issue #2826:
 *   useMotionValue + animate(motionValue, [0, 1], { ease: "linear",
 *   type: "keyframes", times: [0, 1] }) wired to motion.div opacity.
 * The animation should progress linearly across its duration.
 */
export const App = () => {
    const opacity = useMotionValue(0)

    useEffect(() => {
        animate(opacity, [0, 1], {
            duration: 10,
            ease: "linear",
            type: "keyframes",
            times: [0, 1],
        })
    }, [])

    return (
        <motion.div
            id="box"
            style={{
                width: 100,
                height: 100,
                background: "red",
                opacity,
            }}
        />
    )
}
