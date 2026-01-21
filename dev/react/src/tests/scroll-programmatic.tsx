import { scroll, motionValue, MotionValue } from "framer-motion"
import * as React from "react"
import { useEffect, useState, useRef } from "react"

/**
 * Test for issue #2746 and #2748
 * scrollYProgress should update correctly after programmatic scrollTo/scrollBy calls
 */
export const App = () => {
    const [progress, setProgress] = useState(0)
    const [immediateProgress, setImmediateProgress] = useState("")
    const progressRef = useRef<MotionValue<number>>(motionValue(0))

    useEffect(() => {
        return scroll((p, { y }) => {
            progressRef.current.set(y.progress)
            setProgress(y.progress)
        })
    }, [])

    const handleScrollTo = () => {
        const scrollHeight = document.documentElement.scrollHeight
        const clientHeight = document.documentElement.clientHeight
        const maxScroll = scrollHeight - clientHeight
        window.scrollTo({ top: maxScroll / 2 })

        // Check the value after 2 frames - this is when it should be updated
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // Read from the motion value ref to get the current value
                setImmediateProgress(progressRef.current.get().toFixed(4))
            })
        })
    }

    const handleScrollBy = () => {
        window.scrollTo({ top: 0 })
        requestAnimationFrame(() => {
            const scrollHeight = document.documentElement.scrollHeight
            const clientHeight = document.documentElement.clientHeight
            const maxScroll = scrollHeight - clientHeight
            window.scrollBy({ top: maxScroll / 2 })

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setImmediateProgress(progressRef.current.get().toFixed(4))
                })
            })
        })
    }

    return (
        <>
            <div style={{ height: "100vh", backgroundColor: "red" }} />
            <div style={{ height: "100vh", backgroundColor: "green" }} />
            <div style={{ height: "100vh", backgroundColor: "blue" }} />
            <div style={{ height: "100vh", backgroundColor: "yellow" }} />
            <div
                id="progress"
                style={{
                    position: "fixed",
                    top: 0,
                    right: 0,
                    background: "white",
                    padding: "4px 8px",
                }}
            >
                {progress}
            </div>
            <div
                id="immediate-progress"
                style={{
                    position: "fixed",
                    top: 30,
                    right: 0,
                    background: "yellow",
                    padding: "4px 8px",
                }}
            >
                {immediateProgress}
            </div>
            <button
                id="scroll-to-btn"
                onClick={handleScrollTo}
                style={{ position: "fixed", top: 10, left: 10, padding: "8px" }}
            >
                Scroll To Middle
            </button>
            <button
                id="scroll-by-btn"
                onClick={handleScrollBy}
                style={{ position: "fixed", top: 60, left: 10, padding: "8px" }}
            >
                Scroll By Half
            </button>
        </>
    )
}
