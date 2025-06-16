import { scroll, useAnimateMini, animate } from "framer-motion"
import * as React from "react"
import { useEffect } from "react"

export const App = () => {
    const [scope, miniAnimate] = useAnimateMini()

    useEffect(() => {
        if (!scope.current) return

        const stopMiniScrollAnimation = scroll(
            miniAnimate(scope.current, {
                backgroundColor: ["#fff", "#000"],
                color: ["#000", "#fff"],
            })
        )

        const stopScrollAnimation = scroll(
            animate(scope.current, { x: [0, 100] })
        )

        return () => {
            stopMiniScrollAnimation()
            stopScrollAnimation()
        }
    }, [])

    return (
        <>
            <div style={{ ...spacer, backgroundColor: "red" }} />
            <div style={{ ...spacer, backgroundColor: "green" }} />
            <div style={{ ...spacer, backgroundColor: "blue" }} />
            <div style={{ ...spacer, backgroundColor: "yellow" }} />
            <div ref={scope} id="color" style={progressStyle}>
                A
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
    width: 100,
    height: 100,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: 80,
    lineHeight: 80,
    fontWeight: "bold",
}
