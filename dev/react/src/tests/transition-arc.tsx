import { LayoutGroup, motion } from "framer-motion"
import { useState } from "react"

const ITEM_A = { left: 50, top: 200, width: 100, height: 50 }
const ITEM_B = { left: 450, top: 200, width: 100, height: 50 }
const ITEM_B_NEAR = { left: 60, top: 200, width: 100, height: 50 }

export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const variant = params.get("variant") || "arc"
    const [active, setActive] = useState("a")

    const isSmall = variant === "small"
    const itemB = isSmall ? ITEM_B_NEAR : ITEM_B

    /**
     * Place arc and ease at the top level so getValueTransition("layout")
     * picks them both up (it falls back to the full transition when no
     * "layout" key is present). This mirrors how layout.tsx freezes at 50%.
     */
    const transition =
        variant === "none"
            ? { duration: 4, ease: () => 0.5 }
            : { duration: 4, ease: () => 0.5, arc: { amplitude: 1 } }

    return (
        <div
            id="container"
            style={{ position: "relative", width: "100vw", height: "100vh" }}
        >
            <button
                id="toggle"
                onClick={() => setActive(active === "a" ? "b" : "a")}
                style={{ position: "fixed", top: 16, left: 16 }}
            >
                Toggle
            </button>
            <LayoutGroup id="arc-test">
                <div id="item-a" style={{ position: "absolute", ...ITEM_A }}>
                    {active === "a" && (
                        <motion.div
                            id="indicator"
                            layoutId="indicator"
                            transition={transition}
                            style={{
                                width: 100,
                                height: 100,
                                background: "red",
                            }}
                        />
                    )}
                </div>
                <div id="item-b" style={{ position: "absolute", ...itemB }}>
                    {active === "b" && (
                        <motion.div
                            id="indicator"
                            layoutId="indicator"
                            transition={transition}
                            style={{
                                width: 100,
                                height: 100,
                                background: "red",
                            }}
                        />
                    )}
                </div>
            </LayoutGroup>
        </div>
    )
}
