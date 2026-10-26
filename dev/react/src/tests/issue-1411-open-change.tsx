import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import * as ReactDOMClient from "react-dom/client"

/**
 * Issue #1411: a gallery whose thumbnails each have layoutId={id}, and a
 * persistent detail card with layoutId={open}. Opening "one" grows the card
 * out of thumbnail one. "Next" then changes the open card's layoutId to "two":
 *
 * - the card switches instantly, staying where it is (no re-grow),
 * - thumbnail one reappears, animating home from the card's box,
 * - thumbnail two disappears, as the card now leads its layoutId.
 *
 * Every frame's boxes, opacities and visibilities are recorded to
 * window.frames by a rAF loop, and window.changedAt/closedAt hold the frame
 * index at which "Next"/"Close" were clicked.
 *
 * Rendered in its own React root, outside the dev harness's StrictMode, as a
 * production app would be. ?strict=true renders inside it instead.
 */
const strict = new URLSearchParams(window.location.search).get("strict")

export const App = () => {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const rootRef = useRef<ReactDOMClient.Root | null>(null)
    const unmountPending = useRef(false)

    useEffect(() => {
        if (strict || !containerRef.current) return
        unmountPending.current = false
        if (!rootRef.current) {
            rootRef.current = ReactDOMClient.createRoot(containerRef.current)
        }
        rootRef.current.render(<Gallery />)
        return () => {
            unmountPending.current = true
            queueMicrotask(() => {
                if (!unmountPending.current) return
                rootRef.current?.unmount()
                rootRef.current = null
            })
        }
    }, [])

    return strict ? <Gallery /> : <div ref={containerRef} />
}

const transition = {
    type: "tween" as const,
    ease: "linear" as const,
    duration: 2,
}

const items = ["one", "two"]

const record = () => {
    const w = window as any
    w.frames = []
    const tick = () => {
        const frame: Record<string, object> = {}
        for (const id of ["one", "two", "card"]) {
            const element = document.getElementById(id)
            if (!element) continue
            const { x, y, width, height } = element.getBoundingClientRect()
            const style = getComputedStyle(element)
            frame[id] = {
                x,
                y,
                width,
                height,
                opacity: parseFloat(style.opacity),
                visibility: style.visibility,
            }
        }
        w.frames.push(frame)
        requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
}

const Gallery = () => {
    const [open, setOpen] = useState<string | null>(null)

    useEffect(record, [])

    const mark = (key: string) =>
        ((window as any)[key] = (window as any).frames.length)

    return (
        <div style={{ position: "relative", width: 800, height: 600 }}>
            {items.map((id, i) => (
                <motion.div
                    key={id}
                    id={id}
                    layoutId={id}
                    transition={transition}
                    onClick={() => setOpen(id)}
                    style={{
                        position: "absolute",
                        top: 50,
                        left: 20 + i * 180,
                        width: 160,
                        height: 100,
                        background: i ? "royalblue" : "tomato",
                    }}
                />
            ))}
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="card"
                        id="card"
                        layoutId={open}
                        transition={transition}
                        style={{
                            position: "absolute",
                            top: 210,
                            left: 200,
                            width: 400,
                            height: 280,
                            background: "grey",
                            zIndex: 1,
                        }}
                    />
                )}
            </AnimatePresence>
            <button
                id="next"
                style={{ position: "absolute", top: 550 }}
                onClick={() => {
                    mark("changedAt")
                    setOpen("two")
                }}
            >
                next
            </button>
            <button
                id="close"
                style={{ position: "absolute", top: 550, left: 100 }}
                onClick={() => {
                    mark("closedAt")
                    setOpen(null)
                }}
            >
                close
            </button>
        </div>
    )
}
