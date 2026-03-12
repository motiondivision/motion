import { useEffect, useRef, useState } from "react"
import { animate } from "framer-motion"

/**
 * Test for #3102 — filter blur animation should work correctly.
 *
 * Tests valid filter blur animations and verifies that
 * re-animating (simulating HMR) works without issues.
 */
export const App = () => {
    const ref = useRef<HTMLDivElement>(null)
    const [done, setDone] = useState(false)
    const [reanimated, setReanimated] = useState(false)

    useEffect(() => {
        const el = ref.current
        if (!el) return

        // First animation: blur(10px) → blur(0px)
        const anim = animate(
            el,
            { filter: ["blur(10px)", "blur(0px)"] },
            { duration: 0.3 }
        )

        anim.then(() => {
            setDone(true)

            // Re-animate (simulates HMR re-triggering the animation)
            const anim2 = animate(
                el,
                { filter: ["blur(10px)", "blur(0px)"] },
                { duration: 0.3 }
            )

            anim2.then(() => setReanimated(true))
        })
    }, [])

    return (
        <div>
            <div
                id="box"
                ref={ref}
                style={{ width: 100, height: 100, background: "red" }}
            />
            <p id="done">{String(done)}</p>
            <p id="reanimated">{String(reanimated)}</p>
        </div>
    )
}
