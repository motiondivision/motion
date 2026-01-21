import { scroll, motionValue, MotionValue } from "framer-motion"
import * as React from "react"
import { useEffect, useState, useRef } from "react"

/**
 * Test for issue #2746 and #2748
 * This test checks the scenario where the page is scrolled programmatically
 * BEFORE the scroll tracking is set up, simulating:
 * 1. Page loads with existing scroll position (browser restored scroll)
 * 2. Component mounts after programmatic scroll
 *
 * The issue is that scrollYProgress might not reflect the actual scroll position
 * until a manual scroll event fires.
 */
export const App = () => {
    const [showTracker, setShowTracker] = useState(false)
    const [progress, setProgress] = useState<number | null>(null)
    const [initialProgress, setInitialProgress] = useState("")
    const progressRef = useRef<MotionValue<number>>(motionValue(0))

    // On mount, scroll to middle BEFORE setting up scroll tracking
    useEffect(() => {
        const scrollHeight = document.documentElement.scrollHeight
        const clientHeight = document.documentElement.clientHeight
        const maxScroll = scrollHeight - clientHeight
        window.scrollTo({ top: maxScroll / 2 })

        // After scroll completes, mount the scroll tracker component
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setShowTracker(true)
            })
        })
    }, [])

    // Set up scroll tracking only after showTracker is true
    useEffect(() => {
        if (!showTracker) return

        const unsubscribe = scroll((p, { y }) => {
            progressRef.current.set(y.progress)
            setProgress(y.progress)
        })

        // Check the initial progress value after scroll setup
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const value = progressRef.current.get()
                setInitialProgress(value.toFixed(4))
            })
        })

        return unsubscribe
    }, [showTracker])

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
                id="initial-progress"
                style={{
                    position: "fixed",
                    top: 30,
                    right: 0,
                    background: "yellow",
                    padding: "4px 8px",
                }}
            >
                {initialProgress}
            </div>
            <div
                id="tracker-mounted"
                style={{ display: "none" }}
            >
                {showTracker ? "true" : "false"}
            </div>
        </>
    )
}
