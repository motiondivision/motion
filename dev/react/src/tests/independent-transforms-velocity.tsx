import { motion, useAnimationControls } from "framer-motion"
import { useEffect, useRef, useState } from "react"

/**
 * Interrupting an accelerated x tween with a spring towards a lower value
 * must carry the tween's velocity, so the box first keeps moving right.
 */
export const App = () => {
    const controls = useAnimationControls()
    const ref = useRef<HTMLDivElement>(null)
    const [result, setResult] = useState("")

    useEffect(() => {
        const box = ref.current!
        let interruptedAt = 0
        let maxOffset = -Infinity
        let tracking = false
        let running = true

        const track = () => {
            if (!running) return
            if (tracking) {
                maxOffset = Math.max(
                    maxOffset,
                    box.getBoundingClientRect().left
                )
            }
            requestAnimationFrame(track)
        }
        requestAnimationFrame(track)

        controls.start(
            { x: 400 },
            { type: "tween", ease: "linear", duration: 4 }
        )

        const timers = [
            setTimeout(() => {
                interruptedAt = box.getBoundingClientRect().left
                tracking = true
                /**
                 * A soft spring towards a lower value. With the tween's
                 * velocity the box keeps moving right for a moment before
                 * turning back. Without it, it turns back immediately.
                 */
                controls.start(
                    { x: 50 },
                    { type: "spring", stiffness: 5, damping: 2 }
                )
            }, 1000),
            setTimeout(() => {
                running = false
                setResult(
                    JSON.stringify({
                        interruptedAt: Math.round(interruptedAt),
                        maxOffset: Math.round(maxOffset),
                        left: Math.round(box.getBoundingClientRect().left),
                    })
                )
            }, 2500),
        ]

        return () => {
            running = false
            timers.forEach(clearTimeout)
        }
    }, [])

    return (
        <>
            <motion.div
                id="box"
                ref={ref}
                initial={{ x: 0 }}
                animate={controls}
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
