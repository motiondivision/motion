import { scroll } from "framer-motion"
import * as React from "react"
import { useEffect, useState } from "react"

export const App = () => {
    const [progress, setProgress] = useState(0)
    const [showExtraContent, setShowExtraContent] = useState(false)

    useEffect(() => {
        return scroll((p) => setProgress(p), { trackContentSize: true })
    }, [])

    useEffect(() => {
        const timer = setTimeout(() => setShowExtraContent(true), 500)
        return () => clearTimeout(timer)
    }, [])

    return (
        <>
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
            <div id="content-loaded">{showExtraContent ? "loaded" : "loading"}</div>
        </>
    )
}

const spacer = {
    height: "100vh",
}

const progressStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
}
