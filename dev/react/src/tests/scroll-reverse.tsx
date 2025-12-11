import * as React from "react"
import { useEffect, useRef } from "react"
import { scroll } from "framer-motion"

const containerBaseStyle: React.CSSProperties = {
    minHeight: 0,
    maxHeight: "24rem",
    minWidth: "24rem",
    backgroundColor: "thistle",
    margin: "2rem",
    position: "relative",
}

const contentBaseStyle: React.CSSProperties = {
    flexShrink: 0,
}

const progressStyle: React.CSSProperties = {
    pointerEvents: "none",
    position: "sticky",
    textAlign: "center",
    inset: 0,
    padding: "1rem",
    fontSize: "2rem",
}

export function App() {
    const containerRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)]

    useEffect(() => {
        containerRefs.forEach((containerRef, index) => {
            if (containerRef.current) {
                const progressEl = containerRef.current.querySelector(".progress") as HTMLElement
                scroll(
                    (latest: number) => {
                        if (progressEl) {
                            progressEl.textContent = latest.toFixed(3)
                        }
                    },
                    { container: containerRef.current, axis: index >= 1 ? "x" : "y" }
                )
            }
        })
    })

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 0, margin: 0 }}>
            <div
                id="scroller-1"
                ref={containerRefs[0]}
                className="container"
                style={{
                    ...containerBaseStyle,
                    display: "flex",
                    flexDirection: "column-reverse",
                    overflowY: "auto",
                    overflowX: "hidden",
                }}
            >
                <div className="content" style={{ ...contentBaseStyle, width: "24rem", height: "200dvh" }}></div>
                <div className="progress" style={progressStyle}>0.000</div>
            </div>
            <div
                id="scroller-2"
                ref={containerRefs[1]}
                className="container"
                style={{
                    ...containerBaseStyle,
                    display: "flex",
                    flexDirection: "row-reverse",
                    overflowY: "hidden",
                    overflowX: "auto",
                }}
            >
                <div className="content" style={{ ...contentBaseStyle, height: "24rem", width: "200dvh" }}></div>
                <div className="progress" style={progressStyle}>0.000</div>
            </div>
            <div
                id="scroller-3"
                ref={containerRefs[2]}
                className="container"
                style={{
                    ...containerBaseStyle,
                    display: "flex",
                    flexDirection: "column",
                    writingMode: "vertical-rl",
                    overflowY: "hidden",
                    overflowX: "auto",
                }}
            >
                <div className="content" style={{ ...contentBaseStyle, height: "24rem", width: "200dvh" }}></div>
                <div className="progress" style={progressStyle}>0.000</div>
            </div>
            <div
                id="scroller-4"
                ref={containerRefs[3]}
                className="container"
                style={{
                    ...containerBaseStyle,
                    display: "flex",
                    flexDirection: "row",
                    direction: "rtl",
                    overflowY: "hidden",
                    overflowX: "auto",
                }}
            >
                <div className="content" style={{ ...contentBaseStyle, height: "24rem", width: "200dvh" }}></div>
                <div className="progress" style={progressStyle}>0.000</div>
            </div>
        </div>
    )
}