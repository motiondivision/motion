import { motion } from "framer-motion"
import { useRef, useState } from "react"

/**
 * Reproduction for #2941: layoutId transitions have wrong starting position
 * when elements are inside a sticky container with a top offset.
 */

const MenuButton = ({
    label,
    active,
    onClick,
    id,
    indicatorRef,
}: {
    label: string
    active: boolean
    onClick: () => void
    id: string
    indicatorRef: React.RefObject<HTMLDivElement | null>
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
                    ref={indicatorRef}
                    id="indicator"
                    layoutId="indicator"
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: 8,
                        background: "rgba(255, 200, 0, 0.7)",
                    }}
                    transition={{ duration: 10, ease: "linear" }}
                    onLayoutAnimationStart={() => {
                        if (indicatorRef.current) {
                            const rect =
                                indicatorRef.current.getBoundingClientRect()
                            indicatorRef.current.dataset.startTop =
                                String(rect.top)
                            indicatorRef.current.dataset.scrollY = String(
                                window.scrollY
                            )
                        }
                    }}
                />
            )}
        </button>
    )
}

export const App = () => {
    const [active, setActive] = useState(1)
    const indicatorRef = useRef<HTMLDivElement>(null)

    return (
        <div style={{ display: "flex", width: "100%" }}>
            <div>
                <div
                    id="sticky-container"
                    style={{
                        width: 120,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        position: "sticky",
                        top: 20,
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
                            indicatorRef={indicatorRef}
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
