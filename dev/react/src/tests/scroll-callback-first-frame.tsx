import { scroll } from "framer-motion"
import * as React from "react"
import { useEffect, useState } from "react"

export const App = () => {
    const [progress, setProgress] = useState(0)

    useEffect(() => {
        return scroll((p: number, info) => {
            console.log(p, info.y)
            setProgress(2 - p)
        })
    }, [])

    return (
        <>
            <div style={{ ...spacer, backgroundColor: "red" }} />
            <div style={{ ...spacer, backgroundColor: "green" }} />
            <div style={{ ...spacer, backgroundColor: "blue" }} />
            <div style={{ ...spacer, backgroundColor: "yellow" }} />
            <div id="progress" style={progressStyle}>
                {progress}
            </div>
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
