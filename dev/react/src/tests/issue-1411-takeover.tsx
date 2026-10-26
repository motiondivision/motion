import { motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import * as ReactDOMClient from "react-dom/client"

/**
 * Issue #1411: element A's layoutId changes to "shared" while element B,
 * which already has layoutId "shared", is mounted. A is already on screen, so
 * it takes over as lead instantly, staying where it is, and B, now a
 * follower, is hidden.
 *
 * B has a constant layoutDependency so its own MeasureLayout doesn't
 * willUpdate() it on re-render (as a memoised sibling wouldn't re-render at
 * all). The takeover itself must hide B.
 *
 * Rendered in its own React root, outside the dev harness's StrictMode,
 * whose double render in dev would re-render B anyway. The nested root is guarded to a single instance as in
 * use-scroll-target-late-ref.tsx.
 */
export const App = () => {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const rootRef = useRef<ReactDOMClient.Root | null>(null)
    const unmountPending = useRef(false)

    useEffect(() => {
        if (!containerRef.current) return
        unmountPending.current = false
        if (!rootRef.current) {
            rootRef.current = ReactDOMClient.createRoot(containerRef.current)
        }
        rootRef.current.render(<Repro />)
        return () => {
            unmountPending.current = true
            queueMicrotask(() => {
                if (!unmountPending.current) return
                rootRef.current?.unmount()
                rootRef.current = null
            })
        }
    }, [])

    return <div ref={containerRef} />
}

const transition = {
    type: "tween" as const,
    ease: "linear" as const,
    duration: 10,
}

const Repro = () => {
    const [layoutId, setLayoutId] = useState("a")

    return (
        <div style={{ position: "relative", width: 600, height: 400 }}>
            <button id="change" onClick={() => setLayoutId("shared")}>
                change
            </button>
            <motion.div
                id="a"
                layoutId={layoutId}
                transition={transition}
                style={{
                    position: "absolute",
                    top: 50,
                    left: 0,
                    width: 100,
                    height: 100,
                    background: "red",
                }}
            />
            <motion.div
                id="b"
                layoutId="shared"
                layoutDependency={1}
                transition={transition}
                style={{
                    position: "absolute",
                    top: 50,
                    left: 400,
                    width: 100,
                    height: 100,
                    background: "blue",
                }}
            />
        </div>
    )
}
