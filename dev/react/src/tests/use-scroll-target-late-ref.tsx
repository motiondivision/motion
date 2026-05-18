import { useMotionValueEvent, useScroll } from "framer-motion"
import * as React from "react"
import { useEffect, useRef, useState } from "react"
import * as ReactDOMClient from "react-dom/client"

/**
 * Reproduction for #2851 — useScroll target ref hydrated after the hook's
 * own effects run (e.g. via querySelector in a useEffect declared after
 * useScroll). Before the fix, useScroll fell back to the whole-window scroll
 * because target.current was still null when its useEffect ran.
 *
 * The actual reproduction is rendered in a fresh ReactDOM root so it isn't
 * wrapped by the dev harness's StrictMode — StrictMode's double-mount in dev
 * masks the bug because the second mount sees the hydrated ref.
 *
 * StrictMode still double-invokes *this* outer effect, so the nested root is
 * guarded to a single instance: the deferred unmount is cancelled if a
 * remount happens first. Otherwise two <Repro> trees coexist (duplicate
 * #target/#progress IDs, doubled document) and the test reads a stale,
 * window-tracking instance — a React 19 flake unrelated to the fix.
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
        // Defer unmount: React 18 errors when a root is unmounted
        // synchronously from another root's effect cleanup. If StrictMode
        // remounts before the microtask runs, the remount clears the flag
        // and the root is kept.
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

const Repro = () => {
    const targetRef = useRef<HTMLDivElement | null>(null)

    const { scrollYProgress } = useScroll({
        target: targetRef,
        offset: ["start end", "end start"],
    })

    useEffect(() => {
        targetRef.current = document.querySelector<HTMLDivElement>("#target")
    }, [])

    const [progress, setProgress] = useState(0)
    useMotionValueEvent(scrollYProgress, "change", setProgress)

    return (
        <>
            <div style={topSpacer} />
            <div id="target" style={targetStyle} />
            <div style={bottomSpacer} />
            <div id="progress" style={progressStyle}>
                {progress.toFixed(4)}
            </div>
        </>
    )
}

const topSpacer: React.CSSProperties = { height: "200vh" }
const bottomSpacer: React.CSSProperties = { height: "100vh" }
const targetStyle: React.CSSProperties = {
    height: "100vh",
    background: "red",
}
const progressStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    background: "white",
    zIndex: 10,
}
