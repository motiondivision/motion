import { animate, scroll } from "framer-motion"
import * as React from "react"
import { useEffect } from "react"

export const App = () => {
    useEffect(() => {
        const box = document.getElementById("box")!

        const animation = animate(box, {
            opacity: [0, 0.5],
        })

        const stop = scroll(animation, {
            rangeStart: "0%",
            rangeEnd: "20%",
        })

        return () => stop()
    }, [])

    return (
        <>
            <div style={{ height: "500vh" }} />
            <div
                id="box"
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: 100,
                    height: 100,
                    backgroundColor: "red",
                }}
            />
        </>
    )
}
