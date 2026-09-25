import { animate, scroll } from "framer-motion"
import * as React from "react"
import { useEffect } from "react"

/**
 * scroll() with rangeStart/rangeEnd maps the range onto the animation and
 * holds the first keyframe before it and the last keyframe after it.
 *
 * opacity runs on WAAPI, so it uses a native ScrollTimeline/ViewTimeline where
 * supported. x never does, so it always uses the JS observe path.
 */
export const App = () => {
    useEffect(() => {
        const target = document.getElementById("target")!
        const transition = { ease: "linear" } as const
        const targetRange = {
            target,
            rangeStart: "0%",
            rangeEnd: "50%",
        } as const

        const stops = [
            scroll(animate("#box", { opacity: [0, 1] }, transition), {
                rangeStart: 0.1,
                rangeEnd: 0.3,
            }),
            scroll(animate("#js-box", { x: [0, 100] }, transition), {
                rangeStart: "10%",
                rangeEnd: "30%",
            }),
            scroll(
                animate("#target-box", { opacity: [0, 1] }, transition),
                targetRange
            ),
            scroll(
                animate("#target-js-box", { x: [0, 100] }, transition),
                targetRange
            ),
        ]

        const stopAll = () => stops.forEach((stop) => stop())
        Object.assign(window, { stopScroll: stopAll })

        return stopAll
    }, [])

    return (
        <>
            <style>{`body { margin: 0; }`}</style>
            <div style={spacer} />
            <div style={spacer} />
            <div style={{ height: "50vh" }} />
            <div id="target" style={{ height: 500 }} />
            <div style={spacer} />
            <div style={spacer} />
            <div id="box" style={{ ...box, top: 0 }} />
            <div id="js-box" style={{ ...box, top: 100 }} />
            <div id="target-box" style={{ ...box, top: 200 }} />
            <div id="target-js-box" style={{ ...box, top: 300 }} />
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
