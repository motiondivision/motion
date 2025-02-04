import { scroll } from "framer-motion"
import * as React from "react"
import { useEffect, useRef, useState } from "react"

const height = 400

export const App = () => {
    const [progress, setProgress] = useState(0)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!ref.current) return
        return scroll((p: number) => setProgress(p), { source: ref.current })
    }, [])

    return (
        <div
            id="scroller"
            ref={ref}
            style={{ width: 100, height, overflow: "scroll" }}
        >
            <div style={{ ...spacer, backgroundColor: "red" }} />
            <div style={{ ...spacer, backgroundColor: "green" }} />
            <div style={{ ...spacer, backgroundColor: "blue" }} />
            <div style={{ ...spacer, backgroundColor: "yellow" }} />
            <div id="progress" style={progressStyle}>
                {progress}
            </div>
        </div>
    )
}

const spacer = {
    height,
}

const progressStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
}
