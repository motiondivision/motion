import { animate, motion, useMotionValue } from "framer-motion"
import { useEffect, useRef } from "react"

/**
 * Reproduces the bug where a time-defined spring receives velocity from
 * an interrupted animation, causing wild oscillation.
 *
 * The Framer scenario:
 * - Appear effect animates opacity 0.001 → 1 with time-defined spring
 * - On hover, opacity → 0.49 with same spring
 * - WAAPI appear animation sets velocity on motionValue when stopped
 * - Hover animation reads velocity, passes it to findSpring()
 * - findSpring() computes wrong spring parameters → wild oscillation
 *
 * This test uses external motionValues (no WAAPI owner → JS animation)
 * with explicit velocity injection to simulate the WAAPI handoff.
 */

const springTransition = {
    type: "spring" as const,
    duration: 0.4,
    bounce: 0.2,
}

export const App = () => <ExternalMotionValueMode />

function ExternalMotionValueMode() {
    // Start at 0.5 (simulating appear animation mid-flight)
    const opacity = useMotionValue(0.5)
    const scale = useMotionValue(1)
    const trackerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // Simulate WAAPI handoff: inject velocity as if appear animation
        // was stopped mid-flight (NativeAnimationExtended.updateMotionValue
        // calls setWithVelocity on the motionValue)
        const sampleDelta = 10 // ms, same as NativeAnimationExtended
        opacity.setWithVelocity(
            0.45, // prev sample (velocity ~5/s upward)
            0.5, // current
            sampleDelta
        )

        // Start hover animation — reads velocity from motionValue
        animate(opacity, 0.49, springTransition)
        animate(scale, 1.1, springTransition)

        // Track min/max values during hover animation
        let minOpacity = 0.5
        let maxOpacity = 0.5
        let minScale = 1
        let maxScale = 1

        const unsubOpacity = opacity.on("change", (v) => {
            if (v < minOpacity) minOpacity = v
            if (v > maxOpacity) maxOpacity = v
            if (trackerRef.current) {
                trackerRef.current.dataset.minOpacity = minOpacity.toFixed(4)
                trackerRef.current.dataset.maxOpacity = maxOpacity.toFixed(4)
            }
        })

        const unsubScale = scale.on("change", (v) => {
            if (v < minScale) minScale = v
            if (v > maxScale) maxScale = v
            if (trackerRef.current) {
                trackerRef.current.dataset.minScale = minScale.toFixed(4)
                trackerRef.current.dataset.maxScale = maxScale.toFixed(4)
            }
        })

        return () => {
            unsubOpacity()
            unsubScale()
        }
    }, [])

    return (
        <>
            <div id="tracker" ref={trackerRef} />
            <motion.div
                style={{
                    position: "absolute",
                    top: 50,
                    left: 50,
                    width: 231,
                    height: 231,
                    backgroundColor: "rgb(153, 238, 255)",
                }}
            >
                <motion.div
                    id="box"
                    style={{
                        width: 115,
                        height: 106,
                        backgroundColor: "rgb(68, 204, 255)",
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        x: "-50%",
                        y: "-50%",
                        opacity,
                        scale,
                    }}
                />
            </motion.div>
        </>
    )
}
