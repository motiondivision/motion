import { motion, scroll, useMotionValue } from "framer-motion"
import * as React from "react"

export const App = () => {
    const content = useMotionValue(0.5)

    React.useEffect(() => {
        scroll((p: number) => content.set(p), {
            target: document.querySelector("section") as HTMLElement,
        })
    }, [])

    return (
        <>
            <div style={{ height: "50vh" }} />
            <section style={section}>
                <motion.pre id="content">{content}</motion.pre>
            </section>
        </>
    )
}

const section = {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    color: "white",
}
