import { motion, useCycle, useMotionValue } from "framer-motion"

/**
 * An example of animating between different value types
 */

export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const isExternalMotionValue = params.get("use-motion-value") || false
    // When roundtrip param is present, use a fast animation that completes (for testing calc -> 0 -> calc)
    const isRoundTrip = params.get("roundtrip") !== null
    const [x, cycleX] = useCycle<number | string>(0, "calc(3 * var(--width))")
    const xMotionValue = useMotionValue(x)
    const value = isExternalMotionValue ? xMotionValue : undefined

    return (
        <motion.div
            initial={false}
            animate={{ x }}
            transition={
                isRoundTrip
                    ? { duration: 0.1 }
                    : { duration: 5, ease: () => 0.5 }
            }
            style={
                {
                    x: value,
                    width: 100,
                    height: 100,
                    background: "#ffaa00",
                    "--width": "100px",
                } as React.CSSProperties
            }
            onClick={() => cycleX()}
            id="box"
        />
    )
}
