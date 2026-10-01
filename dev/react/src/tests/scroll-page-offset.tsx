import { animate, motion, scroll, useScroll, useTransform } from "framer-motion"
import * as React from "react"
import { useEffect } from "react"

/**
 * A page scroll() and useScroll() with an offset and no target. The offset
 * starts the animations at 1000px of scroll and ends them at 2000px.
 *
 * opacity runs on WAAPI, so where supported the #box animation and the
 * accelerated useScroll opacity can use a native ScrollTimeline. x never
 * runs on WAAPI, so #js-box always uses the JS path.
 */
export const App = () => {
    const { scrollYProgress } = useScroll({ offset: ["1000px", "2000px"] })
    const opacity = useTransform(scrollYProgress, [0, 1], [0, 1])

    useEffect(() => {
        const transition = { ease: "linear" } as const

        const stops = [
            scroll(animate("#box", { opacity: [0, 1] }, transition), {
                offset: ["1000px", "2000px"],
            }),
            scroll(animate("#js-box", { x: [0, 100] }, transition), {
                offset: ["1000px", "2000px"],
            }),
        ]

        return () => stops.forEach((stop) => stop())
    }, [])

    return (
        <>
            <style>{`body { margin: 0; }`}</style>
            <div style={spacer} />
            <div style={spacer} />
            <div style={spacer} />
            <div style={spacer} />
            <div style={spacer} />
            <div id="box" style={{ ...box, top: 0 }} />
            <div id="js-box" style={{ ...box, top: 100 }} />
            <motion.div
                id="use-scroll-box"
                style={{ ...box, top: 200, opacity }}
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
