import * as React from "react"
import { useEffect, useRef } from "react"
import { scroll } from "framer-motion"

const scrollerStyle: React.CSSProperties = {
    width: "200px",
    height: "200px",
    overflow: "auto",
    border: "1px solid black",
    display: "flex",
    margin: "20px",
}

const contentStyle: React.CSSProperties = {
    width: "400px",
    height: "400px",
    background: "linear-gradient(red, blue)",
}

const labelStyle: React.CSSProperties = {
    position: "fixed",
    top: "10px",
    left: "10px",
    fontSize: "24px",
    fontFamily: "monospace",
}

export function App() {
    const colReverseRef = useRef<HTMLDivElement>(null)
    const rowReverseRef = useRef<HTMLDivElement>(null)
    const rtlRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (colReverseRef.current) {
            const progressEl = document.getElementById("progress-col-reverse")!
            scroll(
                ({ y }) => {
                    progressEl.textContent = y.progress.toFixed(3)
                },
                { container: colReverseRef.current }
            )
        }
        if (rowReverseRef.current) {
            const progressEl = document.getElementById("progress-row-reverse")!
            scroll(
                ({ x }) => {
                    progressEl.textContent = x.progress.toFixed(3)
                },
                { container: rowReverseRef.current }
            )
        }
        if (rtlRef.current) {
            const progressEl = document.getElementById("progress-rtl")!
            scroll(
                ({ x }) => {
                    progressEl.textContent = x.progress.toFixed(3)
                },
                { container: rtlRef.current }
            )
        }
    }, [])

    return (
        <div style={{ padding: "40px" }}>
            <h2>Column Reverse</h2>
            <div
                id="scroller-col-reverse"
                ref={colReverseRef}
                style={{
                    ...scrollerStyle,
                    flexDirection: "column-reverse",
                }}
            >
                <div style={contentStyle}></div>
            </div>
            <p>
                Progress: <span id="progress-col-reverse">0</span>
            </p>

            <h2>Row Reverse</h2>
            <div
                id="scroller-row-reverse"
                ref={rowReverseRef}
                style={{
                    ...scrollerStyle,
                    flexDirection: "row-reverse",
                }}
            >
                <div style={contentStyle}></div>
            </div>
            <p>
                Progress: <span id="progress-row-reverse">0</span>
            </p>

            <h2>RTL Direction</h2>
            <div
                id="scroller-rtl"
                ref={rtlRef}
                style={{
                    ...scrollerStyle,
                    direction: "rtl",
                }}
            >
                <div style={contentStyle}></div>
            </div>
            <p>
                Progress: <span id="progress-rtl">0</span>
            </p>
        </div>
    )
}
