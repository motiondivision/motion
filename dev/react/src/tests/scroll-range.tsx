import { animate, scroll } from "framer-motion"
import * as React from "react"
import { useEffect } from "react"

/**
 * Reproduction for #3001: scroll() with rangeStart/rangeEnd should deactivate
 * the animation outside the range, so the element's base CSS (here opacity 0.1,
 * which a :hover etc. could also provide) applies again past rangeEnd — matching
 * native `animation-range`.
 */
export const App = () => {
    useEffect(() => {
        const animation = animate("#box", { opacity: [0, 1] }, { ease: "linear" })

        const stop = scroll(animation, { rangeStart: "0%", rangeEnd: "20%" })

        return () => stop()
    }, [])

    const nativeTimeline =
        typeof window !== "undefined" && "ScrollTimeline" in window

    return (
        <>
            <style>{`#box { opacity: 0.1; }`}</style>
            <div id="native-timeline" style={{ position: "fixed", bottom: 0 }}>
                {nativeTimeline ? "native" : "fallback"}
            </div>
            <div style={spacer} />
            <div style={spacer} />
            <div style={spacer} />
            <div style={spacer} />
            <div style={spacer} />
            <div id="box" style={box} />
        </>
    )
}

const spacer: React.CSSProperties = { height: "100vh" }

const box: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    width: 100,
    height: 100,
    backgroundColor: "red",
}
