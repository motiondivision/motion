import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

/**
 * Renders a popLayout AnimatePresence into an iframe's document via a
 * portal, mirroring UIs rendered into a window opened with window.open().
 */
const boxStyle = { width: 100, height: 100 }

export const App = () => {
    const [state, setState] = useState(true)
    const [body, setBody] = useState<HTMLElement | null>(null)
    const ref = useRef<HTMLIFrameElement>(null)

    useEffect(() => {
        const doc = ref.current?.contentDocument
        if (!doc) return
        doc.body.style.margin = "0"
        setBody(doc.body)
    }, [])

    return (
        <>
            <button id="toggle" onClick={() => setState(!state)}>
                Toggle
            </button>
            <iframe
                ref={ref}
                id="frame"
                style={{ width: 400, height: 400, border: 0 }}
            />
            {body &&
                createPortal(
                    <section style={{ position: "relative" }}>
                        <AnimatePresence mode="popLayout">
                            {state ? (
                                <motion.div
                                    key="a"
                                    id="a"
                                    exit={{
                                        opacity: 0,
                                        transition: { duration: 10 },
                                    }}
                                    style={{ ...boxStyle, background: "red" }}
                                />
                            ) : null}
                            <motion.div
                                key="b"
                                id="b"
                                layout
                                transition={{ ease: () => 1 }}
                                style={{ ...boxStyle, background: "blue" }}
                            />
                        </AnimatePresence>
                    </section>,
                    body
                )}
        </>
    )
}
