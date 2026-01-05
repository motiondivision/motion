import { motion, useCycle } from "framer-motion"

/**
 * Test for GitHub issue #3410
 * When animating from a calc() expression containing CSS variables to a simple value,
 * the animation should interpolate correctly and end at the target value.
 */
export const App = () => {
    // Note: This test is the REVERSE direction of the existing unit-conversion test
    // The existing test goes 0 → calc(3 * var(--width))
    // This test goes calc(100% + var(--offset)) → 0
    const [x, cycleX] = useCycle<number | string>(
        "calc(100% + var(--offset))",
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
