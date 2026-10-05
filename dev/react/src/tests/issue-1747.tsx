import { motion } from "framer-motion"
import { useEffect } from "react"

/**
 * Issue #1747: after a short fast flick from a standstill, drag inertia
 * starts much slower than the finger was moving ("abrupt deceleration"),
 * whereas the same flick while inertia is still animating feels right.
 *
 * Records pointer events and onDragEnd velocity on window for the spec.
 */
declare global {
    interface Window {
        __moves: { y: number; t: number }[]
        __dragEnd: { velocity: number; t: number }[]
    }
}

export const App = () => {
    useEffect(() => {
        window.__moves = []
        window.__dragEnd = []
        const rec = (e: PointerEvent) =>
            window.__moves.push({ y: e.clientY, t: e.timeStamp })
        window.addEventListener("pointerdown", rec, true)
        window.addEventListener("pointermove", rec, true)
        return () => {
            window.removeEventListener("pointerdown", rec, true)
            window.removeEventListener("pointermove", rec, true)
        }
    }, [])

    return (
        <div style={{ height: "100vh", overflow: "hidden" }}>
            <motion.div
                id="box"
                drag="y"
                onDragEnd={(_, info) =>
                    window.__dragEnd.push({
                        velocity: info.velocity.y,
                        t: performance.now(),
                    })
                }
                style={{
                    width: 300,
                    height: 3000,
                    background:
                        "repeating-linear-gradient(#f00 0 50px, #00f 50px 100px)",
                    touchAction: "none",
                }}
            />
        </div>
    )
}
