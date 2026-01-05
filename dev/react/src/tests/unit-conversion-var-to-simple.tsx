import { motion, useCycle } from "framer-motion"

/**
 * Test for GitHub issue #3410
 * Animating from calc() with CSS variable to a simple value should
 * end at the simple value, not preserve the calc structure.
 */

export const App = () => {
    // Use a simple calc with var to isolate the issue
    // calc(100px + 50px) = 150px -> 0
    const [x, cycleX] = useCycle<number | string>(
        "calc(100px + var(--offset))",
        0
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
