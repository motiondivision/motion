import { motion, useMotionValueEvent, useScroll } from "framer-motion"
import { useRef } from "react"

/**
 * Reproduction from issue #2546 (rebuilt from the description, the sandbox
 * is a horizontal fork of #2076's "track element position" example): a
 * horizontally scrolling container, tracking one item's position with
 * useScroll({ container, target }) and reading scrollXProgress.
 *
 * ?axis=x passes axis: "x" explicitly.
 */
const params = new URLSearchParams(window.location.search)
const axis = params.get("axis") as "x" | "y" | null

export const App = () => {
    const container = useRef<HTMLDivElement>(null)
    const target = useRef<HTMLDivElement>(null)
    const { scrollXProgress } = useScroll({
        container,
        target,
        offset: ["start end", "end start"],
        ...(axis ? { axis } : {}),
    })

    useMotionValueEvent(scrollXProgress, "change", (latest) => {
        ;(window as any).__progress = latest
    })

    return (
        <>
            <div
                id="container"
                ref={container}
                style={{
                    width: 400,
                    height: 200,
                    overflowX: "scroll",
                    display: "flex",
                    position: "relative",
                }}
            >
                {Array.from({ length: 10 }, (_, i) => (
                    <div
                        key={i}
                        ref={i === 5 ? target : undefined}
                        id={`item-${i}`}
                        style={{
                            flex: "0 0 200px",
                            height: 200,
                            background: i === 5 ? "red" : "#ccc",
                            borderRight: "1px solid white",
                            boxSizing: "border-box",
                        }}
                    />
                ))}
            </div>
            <motion.div
                id="bar"
                style={{
                    scaleX: scrollXProgress,
                    originX: 0,
                    width: 400,
                    height: 10,
                    background: "blue",
                }}
            />
        </>
    )
}
