import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { createPortal } from "react-dom"

/**
 * Reproduction for #3078: AnimatePresence won't remove modal if a
 * child animation has a defined exit matching current values.
 *
 * Uses createPortal like the original reproduction. The modal's dialog
 * uses variants for enter/exit. Children use variants for enter and
 * exit={{ opacity: 1, scale: 1 }} (same as their animated state).
 */

function Modal({
    children,
    onClose,
}: {
    children: React.ReactNode
    onClose: () => void
}) {
    return createPortal(
        <>
            <div
                id="backdrop"
                onClick={onClose}
                style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.5)",
                }}
            />
            <motion.dialog
                id="modal"
                variants={{
                    hidden: { opacity: 0, y: -30 },
                    visible: { opacity: 1, y: 0 },
                }}
                initial="hidden"
                animate="visible"
                exit="hidden"
                transition={{ type: "tween", duration: 0.3 }}
                open
                style={{
                    position: "fixed",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                }}
            >
                {children}
            </motion.dialog>
        </>,
        document.body
    )
}

function NewChallenge({ onDone }: { onDone: () => void }) {
    return (
        <Modal onClose={onDone}>
            <h2>New Challenge</h2>
            <motion.ul
                variants={{
                    visible: {
                        transition: { staggerChildren: 0.05 },
                    },
                }}
                style={{ listStyle: "none", display: "flex", gap: 10 }}
            >
                {[0, 1].map((i) => (
                    <motion.li
                        key={i}
                        data-testid={`item-${i}`}
                        variants={{
                            hidden: { opacity: 0, scale: 0.5 },
                            visible: { opacity: 1, scale: 1 },
                        }}
                        exit={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 260 }}
                        style={{
                            width: 50,
                            height: 50,
                            background: "coral",
                        }}
                    />
                ))}
            </motion.ul>
            <button id="cancel" onClick={onDone}>
                Cancel
            </button>
        </Modal>
    )
}

export const App = () => {
    const [show, setShow] = useState(false)

    return (
        <div style={{ padding: 20 }}>
            <button id="toggle" onClick={() => setShow(true)}>
                Add Challenge
            </button>
            <AnimatePresence mode="wait">
                {show && <NewChallenge key="challenge" onDone={() => setShow(false)} />}
            </AnimatePresence>
        </div>
    )
}
