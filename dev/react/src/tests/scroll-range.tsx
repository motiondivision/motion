import { animate, scroll } from "framer-motion"
import * as React from "react"
import { useEffect } from "react"

/**
 * Reproduction for #3001: scroll() with rangeStart/rangeEnd should deactivate
 * the animation outside the range, so the element's base CSS (which a :hover
 * etc. could also provide) applies again, matching native `animation-range`.
 *
 * opacity runs on WAAPI, so it uses a native ScrollTimeline/ViewTimeline where
 * supported. x never does, so it always uses the JS observe path.
 * #implicit-box reads its start opacity from the element, which is written
 * inline and mustn't remain outside the range. The #inline boxes have their
 * own inline styles, which must come back outside the range.
 */
export const App = () => {
    useEffect(() => {
        const target = document.getElementById("target")!
        const transition = { ease: "linear" } as const
        const pageRange = { rangeStart: "0%", rangeEnd: "20%" } as const

        const stops = [
            scroll(animate("#box", { opacity: [0, 1] }, transition), pageRange),
            scroll(animate("#js-box", { x: [0, 100] }, transition), {
                rangeStart: 0,
                rangeEnd: 0.2,
            }),
            scroll(
                animate("#implicit-box", { opacity: 1 }, transition),
                pageRange
            ),
            scroll(
                animate("#inline-box", { opacity: [0, 1] }, transition),
                pageRange
            ),
            scroll(
                animate("#inline-js-box", { x: [0, 100] }, transition),
                pageRange
            ),
            scroll(animate("#target-box", { opacity: [0, 1] }, transition), {
                target,
                rangeStart: "0%",
                rangeEnd: "50%",
            }),
            scroll(animate("#target-js-box", { x: [0, 100] }, transition), {
                target,
                rangeStart: "0%",
                rangeEnd: "50%",
            }),
        ]

        const stopAll = () => stops.forEach((stop) => stop())
        Object.assign(window, { stopScroll: stopAll })

        return stopAll
    }, [])

    const nativeTimeline =
        typeof window !== "undefined" && "ScrollTimeline" in window

    return (
        <>
            <style>{`
                body { margin: 0; }
                .box { opacity: 0.1; transform: translateX(300px); }
                #implicit-box.alt { opacity: 0.9; }
            `}</style>
            <div id="native-timeline" style={{ position: "fixed", bottom: 0 }}>
                {nativeTimeline ? "native" : "fallback"}
            </div>
            <div style={spacer} />
            <div style={spacer} />
            <div style={{ height: "50vh" }} />
            <div id="target" style={{ height: 500 }} />
            <div style={spacer} />
            <div style={spacer} />
            <div id="box" className="box" style={{ ...box, top: 0 }} />
            <div id="js-box" className="box" style={{ ...box, top: 100 }} />
            <div id="target-box" className="box" style={{ ...box, top: 200 }} />
            <div
                id="target-js-box"
                className="box"
                style={{ ...box, top: 300 }}
            />
            <div
                id="implicit-box"
                className="box"
                style={{ ...box, top: 400 }}
            />
            <div
                id="inline-box"
                className="box"
                style={{ ...box, top: 500, opacity: 0.3 }}
            />
            <div
                id="inline-js-box"
                className="box"
                style={{ ...box, top: 600, transform: "translateX(200px)" }}
            />
        </>
    )
}

const spacer: React.CSSProperties = { height: "100vh" }

const box: React.CSSProperties = {
    position: "fixed",
    left: 0,
    width: 100,
    height: 100,
    backgroundColor: "red",
}
