import { scroll } from "framer-motion"
import * as React from "react"
import { useEffect, useRef } from "react"

/**
 * A progress-only callback and an info callback track the same target,
 * which starts three viewport heights down the page.
 */
export const App = () => {
    const target = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!target.current) return

        const write = (id: string, value: number) => {
            document.getElementById(id)!.textContent = String(value)
        }

        let progressCalls = 0
        let infoCalls = 0
        let maxVelocity = 0

        const stopProgress = scroll(
            (p: number) => {
                write("progress-calls", ++progressCalls)
                write("progress", p)
            },
            { target: target.current, offset: ["start end", "end start"] }
        )

        const stopInfo = scroll(
            (p, info) => {
                write("info-calls", ++infoCalls)
                write("info-progress", p)
                write("info-velocity", info.y.velocity)
                maxVelocity = Math.max(maxVelocity, info.y.velocity)
                write("info-max-velocity", maxVelocity)
            },
            { target: target.current, offset: ["start end", "end start"] }
        )

        return () => {
            stopProgress()
            stopInfo()
        }
    }, [])

    return (
        <>
            <div style={{ height: "300vh" }} />
            <div ref={target} style={{ height: "100vh", background: "red" }} />
            <div style={{ height: "200vh" }} />
            <div style={labels}>
                <span id="progress-calls">0</span>
                <span id="progress">-</span>
                <span id="info-calls">0</span>
                <span id="info-progress">-</span>
                <span id="info-velocity">-</span>
                <span id="info-max-velocity">-</span>
            </div>
        </>
    )
}

const labels: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    display: "flex",
    gap: 10,
}
