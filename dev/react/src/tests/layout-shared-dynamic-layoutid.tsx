import { CSSProperties, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

/**
 * This test demonstrates what happens when layoutId changes dynamically.
 *
 * Scenario:
 * 1. Three thumbnails with different colors
 * 2. Click a thumbnail to open it as a modal (shared layout animation)
 * 3. The modal has buttons to change the layoutId to another thumbnail
 *
 * This helps us understand the behavior when layoutId changes mid-animation
 * or while in a modal state.
 */

const transition = { duration: 0.5 }

function Thumbnails({
    colors,
    openColor,
    setOpen,
}: {
    colors: string[]
    openColor: string | false
    setOpen: (color: string | false) => void
}) {
    return (
        <div style={thumbnailContainer}>
            {colors.map((color, i) => (
                <motion.div
                    key={color}
                    layoutId={color}
                    onClick={() => setOpen(color)}
                    style={{
                        ...thumbnail,
                        backgroundColor: color,
                    }}
                    transition={transition}
                    data-testid={`thumbnail-${i}`}
                    id={`thumbnail-${i}`}
                />
            ))}
        </div>
    )
}

function Modal({
    color,
    colors,
    setOpen,
    onChangeLayoutId,
}: {
    color: string
    colors: string[]
    setOpen: (color: string | false) => void
    onChangeLayoutId: (newColor: string) => void
}) {
    const otherColors = colors.filter((c) => c !== color)

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={overlay}
                onClick={() => setOpen(false)}
                transition={transition}
                data-testid="overlay"
            />
            <div style={modalContainer}>
                <motion.div
                    layoutId={color}
                    style={{
                        ...modal,
                        backgroundColor: color,
                    }}
                    transition={transition}
                    data-testid="modal"
                    id="modal"
                >
                    <div style={modalContent}>
                        <h2 style={{ margin: 0, color: "#fff" }}>
                            Current: {color}
                        </h2>
                        <p style={{ color: "#fff", opacity: 0.8 }}>
                            Click buttons below to change layoutId
                        </p>
                        <div style={buttonContainer}>
                            {otherColors.map((otherColor, i) => (
                                <button
                                    key={otherColor}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onChangeLayoutId(otherColor)
                                    }}
                                    style={{
                                        ...switchButton,
                                        backgroundColor: otherColor,
                                    }}
                                    data-testid={`switch-to-${i}`}
                                    id={`switch-to-${i}`}
                                >
                                    Switch to {otherColor}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                setOpen(false)
                            }}
                            style={closeButton}
                            data-testid="close-modal"
                            id="close-modal"
                        >
                            Close Modal
                        </button>
                    </div>
                </motion.div>
            </div>
        </>
    )
}

export function App() {
    const [openColor, setOpen] = useState<false | string>(false)

    const handleChangeLayoutId = (newColor: string) => {
        // This changes the layoutId of the modal
        // What happens here is the key question:
        // - Does the old thumbnail animate back?
        // - Does the modal animate from the new thumbnail's position?
        // - Does it just snap?
        console.log(`Changing layoutId from ${openColor} to ${newColor}`)
        setOpen(newColor)
    }

    return (
        <div style={background}>
            <div style={info}>
                <h1>Dynamic layoutId Change Test</h1>
                <p>
                    Click a thumbnail to open it as a modal. Then use the
                    buttons to change the modal's layoutId to another
                    thumbnail's ID.
                </p>
                <p>
                    <strong>Current layoutId:</strong>{" "}
                    {openColor || "none (modal closed)"}
                </p>
            </div>
            <Thumbnails
                colors={colors}
                openColor={openColor}
                setOpen={setOpen}
            />
            <AnimatePresence>
                {openColor !== false && (
                    <Modal
                        key="modal"
                        color={openColor}
                        colors={colors}
                        setOpen={setOpen}
                        onChangeLayoutId={handleChangeLayoutId}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

// Colors for the thumbnails
const colors = ["#e74c3c", "#3498db", "#2ecc71"]

// Styles
const background: CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    background: "#1a1a2e",
    fontFamily: "system-ui, sans-serif",
}

const info: CSSProperties = {
    color: "#fff",
    textAlign: "center",
    marginBottom: 40,
    maxWidth: 600,
}

const thumbnailContainer: CSSProperties = {
    display: "flex",
    gap: 20,
}

const thumbnail: CSSProperties = {
    width: 150,
    height: 150,
    borderRadius: 12,
    cursor: "pointer",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
}

const overlay: CSSProperties = {
    background: "rgba(0, 0, 0, 0.7)",
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
}

const modalContainer: CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "none",
}

const modal: CSSProperties = {
    width: 400,
    height: 300,
    borderRadius: 20,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "auto",
}

const modalContent: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
}

const buttonContainer: CSSProperties = {
    display: "flex",
    gap: 10,
    marginTop: 10,
}

const switchButton: CSSProperties = {
    padding: "10px 20px",
    borderRadius: 8,
    border: "2px solid white",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: 12,
}

const closeButton: CSSProperties = {
    padding: "10px 30px",
    borderRadius: 8,
    border: "none",
    background: "rgba(255, 255, 255, 0.2)",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: 10,
}
