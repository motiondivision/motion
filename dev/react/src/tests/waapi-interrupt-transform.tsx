import { useAnimate } from "framer-motion"
import { useEffect, useRef, useState } from "react"

/**
 * Test for issue #3569: useAnimate WAAPI mid-flight interruption
 * causes one-frame jump to origin.
 *
 * Starts a transform animation, interrupts it mid-flight with a
 * new target, and tracks the minimum translateX to detect any
 * jump back to origin.
 */
export const App = () => {
    const [scope, animate] = useAnimate()
    const [result, setResult] = useState("")
    const minLeftRef = useRef(Infinity)
    const startLeftRef = useRef(0)
    const trackingRef = useRef(false)

    useEffect(() => {
        if (!scope.current) return

        // Record the element's starting position
        startLeftRef.current = scope.current.getBoundingClientRect().left

        let tracking = true
        const track = () => {
            if (!tracking || !scope.current) return
            if (trackingRef.current) {
                const left = scope.current.getBoundingClientRect().left
                minLeftRef.current = Math.min(minLeftRef.current, left)
            }
            requestAnimationFrame(track)
        }
        requestAnimationFrame(track)

        // Start animation: translateX from 0 to 200px over 1s (linear)
        animate(
            scope.current,
            { transform: "translateX(200px)" },
            { duration: 1, ease: "linear" }
        )

        // Start tracking after 100ms (element has moved from start)
        const timer0 = setTimeout(() => {
            trackingRef.current = true
        }, 100)

        // At 300ms, interrupt with new target
        const timer1 = setTimeout(() => {
            animate(
                scope.current,
                { transform: "translateX(400px)" },
                { duration: 1, ease: "linear" }
            )
        }, 300)

        // At 800ms, report minimum position offset from start
        const timer2 = setTimeout(() => {
            tracking = false
            const minOffset = minLeftRef.current - startLeftRef.current
            setResult(String(Math.round(minOffset)))
        }, 800)

        return () => {
            tracking = false
            clearTimeout(timer0)
            clearTimeout(timer1)
            clearTimeout(timer2)
        }
    }, [])

    return (
        <>
            <div
                ref={scope}
                id="box"
                style={{
                    width: 100,
                    height: 100,
                    background: "red",
                }}
            />
            <div id="result">{result}</div>
        </>
    )
}
