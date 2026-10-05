import { motion } from "framer-motion"
import { useState } from "react"
import { createPortal } from "react-dom"

/**
 * Issue #2284: A shared layoutId element that also animates `scale`
 * should never render larger than its final scaled size during the
 * layout animation, and should not jump at the end.
 */
export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const linear = params.get("linear") !== null
    const transition = linear
        ? { duration: 2, ease: "linear" as const }
        : undefined
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div style={{ padding: 20 }}>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                <li>
                    <motion.div
                        id="card"
                        layoutId="card"
                        transition={transition}
                        onClick={() => setIsOpen(true)}
                        style={{ width: 100, height: 150, background: "red" }}
                    />
                </li>
            </ul>
            {isOpen &&
                createPortal(
                    <div
                        style={{
                            position: "fixed",
                            inset: 0,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            background: "#00000060",
                        }}
                    >
                        <motion.div
                            id="modal"
                            layoutId="card"
                            transition={transition}
                            animate={{ scale: 1.5 }}
                            style={{
                                width: 100,
                                height: 150,
                                background: "blue",
                            }}
                        />
                    </div>,
                    document.body
                )}
        </div>
    )
}
