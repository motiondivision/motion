import { motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"

/**
 * animate={{ height: "auto" }} animates between auto sizes: when a render
 * changes the box's content, its height animates from the previous size.
 * Every frame's height is recorded in window.heights so tests can assert
 * on the whole animation rather than sampling it.
 *
 * ?axis=both animates width: "auto" too. ?duration sets the transition
 * duration (default 1). #more adds a child element.
 *
 * ?accordion=true opens and closes the box with
 * animate={{ height: open ? "auto" : 0 }}.
 */
declare global {
    interface Window {
        heights: number[]
        widths: number[]
    }
}

export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const both = params.get("axis") === "both"
    const accordion = Boolean(params.get("accordion"))
    const [height, setHeight] = useState(100)
    const [more, setMore] = useState(false)
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const transition = {
        duration: Number(params.get("duration") ?? 1),
        ease: "linear",
    } as const

    useEffect(() => {
        window.heights = []
        window.widths = []
        let id: number
        const record = () => {
            const box = ref.current!.getBoundingClientRect()
            window.heights.push(box.height)
            window.widths.push(box.width)
            id = requestAnimationFrame(record)
        }
        id = requestAnimationFrame(record)
        return () => cancelAnimationFrame(id)
    }, [])

    const animate = accordion
        ? { height: open ? "auto" : 0 }
        : both
        ? { height: "auto", width: "auto" }
        : { height: "auto" }

    return (
        <div style={{ width: 400 }}>
            {[100, 300, 500].map((h) => (
                <button key={h} id={"h" + h} onClick={() => setHeight(h)}>
                    {h}
                </button>
            ))}
            <button id="more" onClick={() => setMore(true)}>
                more
            </button>
            <button id="toggle" onClick={() => setOpen(!open)}>
                toggle
            </button>
            <motion.div
                ref={ref}
                id="box"
                initial={accordion ? { height: 0 } : false}
                animate={animate}
                transition={transition}
                style={{
                    overflow: "hidden",
                    background: "#09f",
                    display: both ? "inline-block" : "block",
                }}
            >
                <div style={{ height, width: both ? height : "auto" }} />
                {more ? <div style={{ height: 200 }} /> : null}
            </motion.div>
            <div id="below">Below</div>
        </div>
    )
}
