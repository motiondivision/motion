import { motion, useCycle } from "framer-motion"

/**
 * Test for GitHub issue #3410
 * Animating from calc() with CSS variable to a simple value should
 * end at the simple value, not preserve the calc structure.
 *
 * Start at 0, click to go to calc (150px), click again to go back to 0.
 */

export const App = () => {
    // Toggle: 0 <-> calc(100px + 50px) = 150px
    const [x, cycleX] = useCycle<number | string>(
        0,
        "calc(100px + var(--offset))"
    )

    return (
        <motion.div
            initial={false}
            animate={{ x }}
            transition={{ duration: 0.05 }}
            style={{
                width: 100,
                height: 100,
                background: "#ffaa00",
                "--offset": "50px",
            }}
            onClick={() => cycleX()}
            id="box"
        />
    )
}
