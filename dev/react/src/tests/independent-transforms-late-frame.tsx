import { motion } from "framer-motion"
import { useEffect } from "react"

/**
 * For tests/react/independent-transforms-late-frame.spec.ts. The box
 * animates as it mounts, and the main thread is then busy for longer than
 * an animation's start may be late by, as when many components mount.
 */
const frames: number[] = ((window as any).frames = [])

const Busy = () => {
    useEffect(() => {
        const start = performance.now()
        while (performance.now() - start < 150) {}

        const box = document.getElementById("box")!
        const record = () => {
            frames.push(
                new DOMMatrixReadOnly(getComputedStyle(box).transform).m41
            )
            requestAnimationFrame(record)
        }
        requestAnimationFrame(record)
    }, [])

    return null
}

export const App = () => (
    <>
        <motion.div
            id="box"
            initial={{ x: 0, opacity: 0.5 }}
            animate={{ x: 100, opacity: 1 }}
            transition={{ duration: 0.5, ease: "linear" }}
            style={{ width: 100, height: 100, background: "#0077ff" }}
        />
        <Busy />
    </>
)
