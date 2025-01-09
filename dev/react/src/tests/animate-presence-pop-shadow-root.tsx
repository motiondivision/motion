import { AnimatePresence, motion, animate } from "framer-motion"
import { useState, useRef, useEffect } from "react"
import { createRoot } from "react-dom/client"

const boxStyle = {
    width: "100px",
    height: "100px",
    backgroundColor: "red",
}


const AppContent = ({ root }: { root: ShadowRoot }) => {
    const [state, setState] = useState(true)
    const params = new URLSearchParams(window.location.search)
    const position = params.get("position") || ("static" as any)
    const itemStyle =
        position === "relative"
            ? { ...boxStyle, position, top: 100, left: 100 }
            : boxStyle

    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!ref.current) return

        animate(ref.current, { opacity: [0, 1] }, { duration: 1 })
        animate(ref.current, { opacity: [1, 0.5] }, { duration: 1 })
    }, [])

    return (
        <section
            style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                padding: "100px",
            }}
            onClick={() => setState(!state)}
        >
            <AnimatePresence mode="popLayout" root={root}>
                <motion.div
                    key="a"
                    id="a"
                    layout
                    transition={{ ease: () => 1 }}
                    style={{ ...itemStyle }}
                />
                {state ? (
                    <motion.div
                        key="b"
                        id="b"
                        animate={{
                            opacity: 1,
                            transition: { duration: 0.001 },
                        }}
                        exit={{ opacity: 0, transition: { duration: 10 } }}
                        layout
                        style={{ ...itemStyle, backgroundColor: "green" }}
                    />
                ) : null}
                <motion.div
                    key="c"
                    id="c"
                    layout
                    transition={{ ease: () => 1 }}
                    style={{ ...itemStyle, backgroundColor: "blue" }}
                />
            </AnimatePresence>
            <div
                ref={ref}
                style={{ ...itemStyle, backgroundColor: "purple" }}
            />
        </section>
    )
}

export const App = () => {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!ref.current) return

        const shadowRoot =
            ref.current.shadowRoot ?? ref.current.attachShadow({ mode: "open" })
        const root = createRoot(shadowRoot)
        root.render(<AppContent root={shadowRoot} />)
        return () => {
            root.unmount();
        }
    }, [])

    return <div id="shadow" ref={ref}></div>
}
