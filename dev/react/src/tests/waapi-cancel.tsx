import { animate } from "framer-motion"
import { useEffect } from "react"

export const App = () => {
    useEffect(() => {
        const controls = animate(
            "#box",
            { x: [0, 100], opacity: [0, 1] },
            { duration: 1 }
        )

        controls.cancel()
        controls.complete()
    }, [])

    return (
        <section
            style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                padding: "100px",
            }}
        >
            <div
                id="box"
                style={{
                    width: "100px",
                    height: "100px",
                    backgroundColor: "red",
                    opacity: 0,
                }}
            />
        </section>
    )
}
