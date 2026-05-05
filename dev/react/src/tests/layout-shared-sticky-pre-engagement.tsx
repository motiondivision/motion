import { motion } from "framer-motion"
import { useState } from "react"

/**
 * Companion to layout-shared-sticky: exercises the case where the sticky
 * ancestor exists but is NOT yet engaged. With scrollY > 0 but below the
 * engagement threshold, the buggy behaviour skips the root scroll offset
 * and the animation starts ~scrollY pixels off.
 */

const MenuButton = ({
    label,
    active,
    onClick,
    id,
}: {
    label: string
    active: boolean
    onClick: () => void
    id: string
}) => {
    return (
        <button
            id={id}
            onClick={onClick}
            style={{
                position: "relative",
                border: "1px solid #ccc",
                borderRadius: 8,
                padding: "8px 16px",
                background: "transparent",
                cursor: "pointer",
            }}
        >
            {label}
            {active && (
                <motion.div
                    id="indicator"
                    layoutId="indicator"
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: 8,
                        background: "rgba(255, 200, 0, 0.7)",
                    }}
                    transition={{ duration: 10, ease: "linear" }}
                />
            )}
        </button>
    )
}

export const App = () => {
    const [active, setActive] = useState(1)

    return (
        <div style={{ display: "flex", width: "100%" }}>
            <div>
                {/* Header pushes sticky's natural top to 500px so engagement
                    requires scrollY >= 400 (sticky top: 100). */}
                <div id="header" style={{ height: 500, background: "#ddd" }} />
                <div
                    id="sticky-container"
                    style={{
                        width: 120,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        position: "sticky",
                        top: 100,
                        padding: 8,
                    }}
                >
                    {[1, 2, 3, 4].map((v) => (
                        <MenuButton
                            key={v}
                            id={`btn-${v}`}
                            label={v.toString()}
                            active={v === active}
                            onClick={() => setActive(v)}
                        />
                    ))}
                </div>
            </div>
            <div
                id="content"
                style={{
                    height: "500vh",
                    background: "#eee",
                    flex: 1,
                }}
            />
        </div>
    )
}
