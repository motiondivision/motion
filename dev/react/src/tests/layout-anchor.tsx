import { motion } from "framer-motion"
import React, { useState } from "react"

/**
 * Test for layoutAnchor prop with custom anchor point controls.
 *
 * Click the parent boxes to toggle expanded/collapsed.
 * Use the sliders to adjust the anchor point of the green child.
 * The red child has no anchor for comparison.
 */
export function App() {
    const [expanded, setExpanded] = useState(false)
    const [anchorX, setAnchorX] = useState(0.5)
    const [anchorY, setAnchorY] = useState(0.5)

    return (
        <>
            <div
                style={{
                    position: "fixed",
                    top: 10,
                    right: 10,
                    padding: 16,
                    background: "#fff",
                    borderRadius: 8,
                    boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
                    zIndex: 10,
                    color: "#333",
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 14,
                    minWidth: 200,
                }}
            >
                <div style={{ fontWeight: 600, marginBottom: 12 }}>
                    layoutAnchor
                </div>
                <label style={{ display: "block", marginBottom: 8 }}>
                    x: {anchorX.toFixed(2)}
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={anchorX}
                        onChange={(e) => setAnchorX(parseFloat(e.target.value))}
                        style={{ display: "block", width: "100%" }}
                    />
                </label>
                <label style={{ display: "block", marginBottom: 8 }}>
                    y: {anchorY.toFixed(2)}
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={anchorY}
                        onChange={(e) => setAnchorY(parseFloat(e.target.value))}
                        style={{ display: "block", width: "100%" }}
                    />
                </label>
                <div
                    style={{
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                        marginTop: 4,
                    }}
                >
                    {[
                        { label: "TL", x: 0, y: 0 },
                        { label: "TC", x: 0.5, y: 0 },
                        { label: "TR", x: 1, y: 0 },
                        { label: "CL", x: 0, y: 0.5 },
                        { label: "C", x: 0.5, y: 0.5 },
                        { label: "CR", x: 1, y: 0.5 },
                        { label: "BL", x: 0, y: 1 },
                        { label: "BC", x: 0.5, y: 1 },
                        { label: "BR", x: 1, y: 1 },
                    ].map((preset) => (
                        <button
                            key={preset.label}
                            onClick={() => {
                                setAnchorX(preset.x)
                                setAnchorY(preset.y)
                            }}
                            style={{
                                padding: "4px 8px",
                                border:
                                    anchorX === preset.x &&
                                    anchorY === preset.y
                                        ? "2px solid #007aff"
                                        : "1px solid #ccc",
                                borderRadius: 4,
                                background:
                                    anchorX === preset.x &&
                                    anchorY === preset.y
                                        ? "#e8f0fe"
                                        : "#fff",
                                cursor: "pointer",
                                fontSize: 12,
                            }}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
                <div
                    style={{
                        marginTop: 12,
                        padding: 8,
                        background: "#f5f5f5",
                        borderRadius: 4,
                        fontSize: 12,
                        fontFamily: "monospace",
                    }}
                >
                    {`{ x: ${anchorX}, y: ${anchorY} }`}
                </div>
            </div>

            <div
                style={{
                    display: "flex",
                    gap: 40,
                    padding: 20,
                }}
            >
                <div>
                    <div
                        style={{
                            fontFamily: "system-ui, sans-serif",
                            fontSize: 13,
                            marginBottom: 8,
                            color: "#aaa",
                        }}
                    >
                        With layoutAnchor (green)
                    </div>
                    <motion.div
                        id="parent"
                        layout
                        onClick={() => setExpanded(!expanded)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: expanded ? 400 : 200,
                            height: expanded ? 400 : 200,
                            background: "rgba(0,0,0,0.1)",
                            cursor: "pointer",
                        }}
                        transition={{
                            type: "tween",
                            ease: "linear",
                            duration: 1,
                        }}
                    >
                        <motion.div
                            id="child-anchored"
                            layout
                            layoutAnchor={{ x: anchorX, y: anchorY }}
                            style={{
                                width: 50,
                                height: 50,
                                background: "green",
                            }}
                            transition={{
                                type: "tween",
                                ease: "linear",
                                duration: 1,
                                delay: 0.5,
                            }}
                        />
                    </motion.div>
                </div>

                <div>
                    <div
                        style={{
                            fontFamily: "system-ui, sans-serif",
                            fontSize: 13,
                            marginBottom: 8,
                            color: "#aaa",
                        }}
                    >
                        Without layoutAnchor (red)
                    </div>
                    <motion.div
                        id="parent-no-anchor"
                        layout
                        onClick={() => setExpanded(!expanded)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: expanded ? 400 : 200,
                            height: expanded ? 400 : 200,
                            background: "rgba(0,0,0,0.1)",
                            cursor: "pointer",
                        }}
                        transition={{
                            type: "tween",
                            ease: "linear",
                            duration: 1,
                        }}
                    >
                        <motion.div
                            id="child-no-anchor"
                            layout
                            style={{
                                width: 50,
                                height: 50,
                                background: "red",
                            }}
                            transition={{
                                type: "tween",
                                ease: "linear",
                                duration: 1,
                                delay: 0.5,
                            }}
                        />
                    </motion.div>
                </div>

                <div>
                    <div
                        style={{
                            fontFamily: "system-ui, sans-serif",
                            fontSize: 13,
                            marginBottom: 8,
                            color: "#aaa",
                        }}
                    >
                        layoutAnchor={"{false}"} (blue)
                    </div>
                    <motion.div
                        id="parent-false-anchor"
                        layout
                        onClick={() => setExpanded(!expanded)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: expanded ? 400 : 200,
                            height: expanded ? 400 : 200,
                            background: "rgba(0,0,0,0.1)",
                            cursor: "pointer",
                        }}
                        transition={{
                            type: "tween",
                            ease: "linear",
                            duration: 1,
                        }}
                    >
                        <motion.div
                            id="child-false-anchor"
                            layout
                            layoutAnchor={false}
                            style={{
                                width: 50,
                                height: 50,
                                background: "dodgerblue",
                            }}
                            transition={{
                                type: "tween",
                                ease: "linear",
                                duration: 1,
                                delay: 0.5,
                            }}
                        />
                    </motion.div>
                </div>
            </div>
        </>
    )
}
