import { motion } from "framer-motion"
import { useRef, useState } from "react"

/**
 * Ref dragConstraints whose element re-renders, with `layout` animations
 * (#1827 review). The toggle button:
 *
 * ?mode=move        — moves the container (with `layout`) 100px
 * ?mode=movestyle   — as move, also changing its other styles
 * ?mode=boxlayout   — moves the container, the draggable has `layout`
 * ?mode=scalelayout — scales the container (with `layout`) from 1 to 1.5
 * ?mode=scalesibling — as scalelayout, with the draggable as its sibling
 */
export const App = () => {
    const mode =
        new URLSearchParams(window.location.search).get("mode") || "move"
    const ref = useRef<HTMLDivElement>(null)
    const [toggled, setToggled] = useState(false)
    const spacer = mode !== "scalelayout" && toggled ? 100 : 0
    const restyled = mode === "movestyle" && toggled
    const box = (
        <motion.div
            id="box"
            layout={mode === "boxlayout"}
            drag
            dragConstraints={ref}
            dragElastic={0}
            dragMomentum={false}
            style={{
                width: 100,
                height: 100,
                background: "red",
                position: mode === "scalesibling" ? "absolute" : undefined,
                top: 0,
                left: 0,
            }}
        />
    )

    if (mode === "scalesibling") {
        return (
            <div style={{ position: "relative", margin: "100px 150px" }}>
                <button
                    id="toggle"
                    onClick={() => setToggled(!toggled)}
                    style={{ position: "fixed", top: 600, left: 10 }}
                >
                    toggle
                </button>
                <motion.div
                    id="constraints"
                    ref={ref}
                    layout
                    transition={{ duration: 0.3 }}
                    style={{
                        width: 500,
                        height: 300,
                        background: "rgba(0,0,255,0.1)",
                        scale: toggled ? 1.5 : 1,
                    }}
                />
                {box}
            </div>
        )
    }

    return (
        <div style={{ padding: 0, margin: 0 }}>
            <button
                id="toggle"
                onClick={() => setToggled(!toggled)}
                style={{ position: "fixed", top: 600, left: 10 }}
            >
                toggle
            </button>
            <div style={{ display: "flex" }}>
                <div style={{ width: spacer, height: 10, flexShrink: 0 }} />
                <motion.div
                    id="constraints"
                    ref={ref}
                    layout={mode !== "boxlayout"}
                    transition={{ duration: 0.3 }}
                    style={{
                        width: 500,
                        height: 300,
                        background: restyled
                            ? "rgba(0,255,0,0.1)"
                            : "rgba(0,0,255,0.1)",
                        opacity: restyled ? 0.9 : 1,
                        marginTop: spacer + (mode === "scalelayout" ? 100 : 0),
                        marginLeft: mode === "scalelayout" ? 150 : 0,
                        scale: mode === "scalelayout" && toggled ? 1.5 : 1,
                    }}
                >
                    {box}
                </motion.div>
            </div>
        </div>
    )
}
