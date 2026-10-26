import { motion } from "framer-motion"
import { useEffect, useState } from "react"

/**
 * Interrupting a backgroundColor animation halfway (by animating back to
 * the start colour) should continue from the colour on screen. It jumped
 * while backgroundColor ran on WAAPI.
 *
 * Every frame's rendered colour is logged to window.colorFrames as
 * [timestamp, computed backgroundColor], and the interrupt time to
 * window.interruptedAt, so the spec can look for a discontinuity there.
 */
declare global {
    interface Window {
        colorFrames: Array<[number, string]>
        interruptedAt: number
    }
}

export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const from = params.get("from") || "rgb(255, 0, 0)"
    const to = params.get("to") || "rgb(0, 0, 255)"
    const [target, setTarget] = useState(to)

    useEffect(() => {
        const box = document.getElementById("box")!
        const frames: Array<[number, string]> = []
        window.colorFrames = frames

        let id = 0
        const record = (timestamp: number) => {
            frames.push([timestamp, getComputedStyle(box).backgroundColor])
            id = requestAnimationFrame(record)
        }
        id = requestAnimationFrame(record)

        const timeout = setTimeout(() => {
            window.interruptedAt = performance.now()
            setTarget(from)
        }, 550)
        const stop = setTimeout(() => cancelAnimationFrame(id), 1900)

        return () => {
            cancelAnimationFrame(id)
            clearTimeout(timeout)
            clearTimeout(stop)
        }
    }, [])

    return (
        <motion.div
            id="box"
            initial={{ backgroundColor: from }}
            animate={{ backgroundColor: target }}
            transition={{ duration: 1, ease: "linear" }}
            style={{ width: 100, height: 100 }}
        />
    )
}
