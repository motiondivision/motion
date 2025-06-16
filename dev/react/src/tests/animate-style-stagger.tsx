import { animateMini, stagger } from "framer-motion"
import { useEffect } from "react"

const containerStyles = {
    position: "relative" as const,
    display: "flex",
    flexDirection: "column" as const,
    padding: "100px",
}

const boxStyles = {
    width: "100px",
    height: "100px",
    backgroundColor: "red",
    opacity: 0,
}

export const App = () => {
    useEffect(() => {
        const controls = animateMini(
            "#box",
            { opacity: [0, 1] },
            { duration: 0.2, delay: stagger(0.5) }
        )

        return () => controls.stop()
    }, [])

    return (
        <div style={containerStyles}>
            <div id="box" style={boxStyles} />
        </div>
    )
}
