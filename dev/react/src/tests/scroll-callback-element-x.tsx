import { scroll } from "framer-motion"
import * as React from "react"
import { useEffect, useRef, useState } from "react"

const width = 400

export const App = () => {
    const [progress, setProgress] = useState(0)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!ref.current) return
        return scroll(
            (latest: number) => {
                console.log(latest)
                setProgress(latest)
            },
            { source: ref.current, axis: "x" }
        )
    }, [])

    return (
        <div
            id="scroller"
            ref={ref}
            style={{
                height: 200,
                width: width,
                overflow: "scroll",
                display: "flex",
                flexDirection: "row",
            }}
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
    width,
    height: 200,
    flex: `0 0 ${width}px`,
}

const progressStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
}
