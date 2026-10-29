import { motion, useAutoSize } from "framer-motion"
import { useEffect, useRef, useState } from "react"

/**
 * useAutoSize: the box's height animates whenever its content changes
 * size. Every frame's height is recorded in window.heights so tests can
 * assert on the whole animation rather than sampling it.
 *
 * ?axis=both also animates width. The box contains a block of the chosen
 * height and, with ?aspect=true, a block whose height follows the
 * container width (to check width-driven reflow snaps).
 *
 * ?accordion=true also opens and closes the box with
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
    const axis = (params.get("axis") as "y" | "both") || "y"
    const [height, setHeight] = useState(100)
    const [width, setWidth] = useState(400)
    const accordion = Boolean(params.get("accordion"))
    const [open, setOpen] = useState(false)
    const transition = { duration: 1, ease: "linear" } as const
    const ref = useRef<HTMLDivElement>(null)

    useAutoSize(ref, { axis, ...transition })

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

        /**
         * Sizes read in requestAnimationFrame are from before this frame's
         * ResizeObserver callbacks, which useAutoSize uses to keep the
         * previous size on screen. This observer runs after useAutoSize's,
         * so correct the frame's entry to what's actually painted.
         */
        const observer = new ResizeObserver(() => {
            const box = ref.current!.getBoundingClientRect()
            window.heights[window.heights.length - 1] = box.height
            window.widths[window.widths.length - 1] = box.width
        })
        observer.observe(ref.current!)

        return () => {
            cancelAnimationFrame(id)
            observer.disconnect()
        }
    }, [])

    return (
        <div style={{ width }}>
            {[100, 300, 500].map((h) => (
                <button key={h} id={"h" + h} onClick={() => setHeight(h)}>
                    {h}
                </button>
            ))}
            <button id="narrow" onClick={() => setWidth(200)}>
                narrow
            </button>
            <button id="toggle" onClick={() => setOpen(!open)}>
                toggle
            </button>
            <motion.div
                ref={ref}
                id="box"
                initial={accordion ? { height: 0 } : false}
                animate={accordion ? { height: open ? "auto" : 0 } : undefined}
                transition={transition}
                style={{
                    overflow: "hidden",
                    background: "#09f",
                    display: axis === "both" ? "inline-block" : "block",
                }}
            >
                <div style={{ height, width: axis === "both" ? height : "auto" }} />
                {params.get("aspect") ? (
                    <div style={{ aspectRatio: "2", background: "#f09" }} />
                ) : null}
            </motion.div>
            <div id="below">Below</div>
        </div>
    )
}
