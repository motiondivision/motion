import { magnetic, MagneticOptions, motion } from "framer-motion"
import { useRef, useState } from "react"

/**
 * Magnetic drag targets. Switch between the variants with the buttons.
 */
const variants: Record<string, MagneticOptions> = {
    Pull: { radius: 120, pull: 0.6 },
    Snap: { radius: 120, pull: 0.3, snap: 40 },
    "Release only": { radius: 120, pull: 0 },
}

export const App = () => {
    const [variant, setVariant] = useState("Snap")
    const [active, setActive] = useState<Element | null>(null)
    const slots = [
        useRef<HTMLDivElement>(null),
        useRef<HTMLDivElement>(null),
        useRef<HTMLDivElement>(null),
    ]

    return (
        <div style={page}>
            <div style={{ display: "flex", gap: 8 }}>
                {Object.keys(variants).map((name) => (
                    <button
                        key={name}
                        aria-pressed={name === variant}
                        onClick={() => setVariant(name)}
                        style={{
                            ...button,
                            background: name === variant ? "#eee" : "#16161d",
                            color: name === variant ? "#0b0b0f" : "#aaa",
                        }}
                    >
                        {name}
                    </button>
                ))}
            </div>
            <div style={{ position: "relative", height: 240, marginTop: 80 }}>
                {[200, 360, 520].map((left, i) => (
                    <div
                        key={left}
                        ref={slots[i]}
                        style={{
                            ...box,
                            left,
                            border: "2px dashed",
                            borderColor:
                                active === slots[i].current
                                    ? "#8df0cc"
                                    : "#333",
                        }}
                    />
                ))}
                <motion.div
                    id="card"
                    drag
                    dragConstraints={magnetic(slots, {
                        ...variants[variant],
                        onChange: setActive,
                    })}
                    whileDrag={{ scale: 1.08 }}
                    style={{
                        ...box,
                        left: 0,
                        background: "#8df0cc",
                        cursor: "grab",
                    }}
                />
            </div>
        </div>
    )
}

const page: React.CSSProperties = {
    padding: 40,
    minHeight: "100vh",
    boxSizing: "border-box",
    background: "#0b0b0f",
    fontFamily: "system-ui, sans-serif",
}

const button: React.CSSProperties = {
    font: "inherit",
    padding: "8px 14px",
    borderRadius: 999,
    border: "1px solid #333",
    cursor: "pointer",
}

const box: React.CSSProperties = {
    position: "absolute",
    top: 0,
    width: 80,
    height: 80,
    borderRadius: 20,
    boxSizing: "border-box",
}
