import { motion, useCycle, useMotionValue, useMotionValueEvent } from "framer-motion"
import { useRef, useEffect } from "react"

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
    const xMotionValue = useMotionValue(x)
    const boxRef = useRef<HTMLDivElement>(null)

    useMotionValueEvent(xMotionValue, "animationComplete", () => {
        // Log the final motion value and computed style
        const finalValue = xMotionValue.get()
        const computedTransform = boxRef.current
            ? getComputedStyle(boxRef.current).transform
            : "no element"
        console.log("Animation complete:", {
            motionValue: finalValue,
            motionValueType: typeof finalValue,
            computedTransform,
        })
        // Expose for Cypress
        ;(window as any).__debugInfo = {
            motionValue: finalValue,
            computedTransform,
        }
    })

    return (
        <motion.div
            ref={boxRef}
            initial={false}
            animate={{ x }}
            transition={{ duration: 0.05 }}
            style={{
                x: xMotionValue,
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
