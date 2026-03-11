import { scroll } from "framer-motion"
import * as React from "react"
import { useEffect, useRef, useState } from "react"

const height = 400

export const App = () => {
    const [progress, setProgress] = useState(0)
    const [showExtraContent, setShowExtraContent] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!ref.current) return
        return scroll((p: number) => setProgress(p), {
            source: ref.current,
            trackContentSize: true,
        })
    }, [])

    useEffect(() => {
        const timer = setTimeout(() => setShowExtraContent(true), 500)
        return () => clearTimeout(timer)
    }, [])

    return (
        <div
            id="scroller"
            ref={ref}
            style={{ width: 100, height, overflow: "scroll" }}
        >
            <div style={{ ...spacer, backgroundColor: "red" }} />
            <div style={{ ...spacer, backgroundColor: "green" }} />
            {showExtraContent && (
                <>
                    <div
                        id="extra-content"
                        style={{ ...spacer, backgroundColor: "purple" }}
                    />
                    <div style={{ ...spacer, backgroundColor: "orange" }} />
                </>
            )}
            <div id="progress" style={progressStyle}>
                {progress.toFixed(4)}
            </div>
            <div id="content-loaded" style={loadedStyle}>
                {showExtraContent ? "loaded" : "loading"}
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

const loadedStyle: React.CSSProperties = {
    position: "fixed",
    top: 20,
    left: 0,
}
