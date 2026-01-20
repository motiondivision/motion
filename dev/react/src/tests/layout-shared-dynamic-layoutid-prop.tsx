import { CSSProperties, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

/**
 * This test demonstrates what happens when layoutId PROP changes on a single component.
 *
 * Unlike layout-shared-dynamic-layoutid.tsx which may remount the modal,
 * this test keeps the modal mounted and only changes its layoutId prop.
 *
 * This is the core test for the dynamic layoutId feature.
 */

const transition = { duration: 0.5 }

function Thumbnails({
    colors,
    activeLayoutId,
}: {
    colors: string[]
    activeLayoutId: string | null
}) {
    return (
        <div style={thumbnailContainer}>
            {colors.map((color, i) => (
                <motion.div
                    key={color}
                    layoutId={color}
                    style={{
                        ...thumbnail,
                        backgroundColor: color,
                        // Dim the thumbnail whose layoutId is currently used by the modal
                        opacity: activeLayoutId === color ? 0.3 : 1,
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
    layoutId,
    colors,
    onChangeLayoutId,
    onClose,
}: {
    layoutId: string
    colors: string[]
    onChangeLayoutId: (newLayoutId: string) => void
    onClose: () => void
}) {
    // Find the color that matches the current layoutId
    const currentColor = colors.find((c) => c === layoutId) || colors[0]
    const otherColors = colors.filter((c) => c !== layoutId)

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={overlay}
                onClick={onClose}
                transition={transition}
                data-testid="overlay"
            />
            <div style={modalContainer}>
                {/*
                    KEY POINT: This is a SINGLE component whose layoutId prop changes.
                    We're NOT unmounting/remounting - we're changing the prop on the same instance.
                */}
                <motion.div
                    layoutId={layoutId}
                    style={{
                        ...modal,
                        backgroundColor: currentColor,
                    }}
                    transition={transition}
                    data-testid="modal"
                    id="modal"
                >
                    <div style={modalContent}>
                        <h2 style={{ margin: 0, color: "#fff" }}>
                            layoutId: {layoutId}
                        </h2>
                        <p style={{ color: "#fff", opacity: 0.8, fontSize: 14 }}>
                            The modal's layoutId prop will change when you click
                            buttons below.
                            <br />
                            This is the same component instance, just with a
                            different layoutId.
                        </p>
                        <div style={buttonContainer}>
                            {otherColors.map((otherColor, i) => (
                                <button
                                    key={otherColor}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        console.log(
                                            `[Modal] Changing layoutId from "${layoutId}" to "${otherColor}"`
                                        )
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
                                onClose()
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
    const [isOpen, setIsOpen] = useState(false)
    const [modalLayoutId, setModalLayoutId] = useState<string>(colors[0])

    const handleOpen = (color: string) => {
        setModalLayoutId(color)
        setIsOpen(true)
    }

    const handleChangeLayoutId = (newLayoutId: string) => {
        // This ONLY changes the layoutId prop, keeping the modal mounted
        console.log(
            `[App] Changing modal layoutId from "${modalLayoutId}" to "${newLayoutId}"`
        )
        setModalLayoutId(newLayoutId)
    }

    return (
        <div style={background}>
            <div style={info}>
                <h1>Dynamic layoutId Prop Change Test</h1>
                <p>
                    This test keeps the modal component mounted and only changes
                    its <code>layoutId</code> prop.
                </p>
                <p>
                    <strong>Modal open:</strong> {isOpen ? "Yes" : "No"}
                    <br />
                    <strong>Modal layoutId:</strong> {modalLayoutId}
                </p>
                <p style={{ fontSize: 14, opacity: 0.7 }}>
                    Expected behavior: When layoutId changes, the modal should
                    now be associated with a different thumbnail. Closing should
                    animate back to the NEW thumbnail.
                </p>
            </div>

            {/* Thumbnails that can be clicked to open */}
            <div style={thumbnailContainer}>
                {colors.map((color, i) => (
                    <motion.div
                        key={color}
                        layoutId={color}
                        onClick={() => handleOpen(color)}
                        style={{
                            ...thumbnail,
                            backgroundColor: color,
                            cursor: "pointer",
                            opacity:
                                isOpen && modalLayoutId === color ? 0.3 : 1,
                        }}
                        transition={transition}
                        data-testid={`thumbnail-${i}`}
                        id={`thumbnail-${i}`}
                    >
                        <span style={{ color: "#fff", fontWeight: "bold" }}>
                            {i + 1}
                        </span>
                    </motion.div>
                ))}
            </div>

            <AnimatePresence>
                {isOpen && (
                    <Modal
                        key="modal-instance" // Same key - same component instance
                        layoutId={modalLayoutId}
                        colors={colors}
                        onChangeLayoutId={handleChangeLayoutId}
                        onClose={() => setIsOpen(false)}
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
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: 24,
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
    padding: 20,
    textAlign: "center",
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
