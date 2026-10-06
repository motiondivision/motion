import { motion, useAnimationControls } from "framer-motion"
import { useEffect, useRef, useState } from "react"

/**
 * x and y share the translate property. Interrupting only x while y is
 * mid-flight moves both to the main thread without a visual jump, and y
 * continues from where it was.
 */
export const App = () => {
    const controls = useAnimationControls()
    const ref = useRef<HTMLDivElement>(null)
    const [result, setResult] = useState("")

    useEffect(() => {
        const box = ref.current!
        const startLeft = box.getBoundingClientRect().left
        let minOffset = Infinity
        let tracking = false
        let running = true

        const track = () => {
            if (!running) return
            if (tracking) {
                minOffset = Math.min(
                    minOffset,
                    box.getBoundingClientRect().left - startLeft
                )
            }
            requestAnimationFrame(track)
        }
        requestAnimationFrame(track)

        controls.start(
            { x: 200, y: 100 },
            { type: "tween", ease: "linear", duration: 10 }
        )

        const timers = [
            setTimeout(() => (tracking = true), 500),
            setTimeout(() => {
                controls.start(
                    { x: 400 },
                    { type: "tween", ease: "linear", duration: 10 }
                )
            }, 800),
            setTimeout(() => {
                running = false
                const { translate } = getComputedStyle(box)
                setResult(
                    JSON.stringify({
                        animations: box.getAnimations().length,
                        minOffset: Math.round(minOffset),
                        y: parseFloat(translate.split(" ")[1] || "0"),
                        transform: box.style.transform,
                    })
                )
            }, 2000),
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
                initial={{ x: 0, y: 0 }}
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
