import { motion } from "framer-motion"
import { useEffect, useState } from "react"

/**
 * Issue #1411: layoutId changed after first render should be honoured.
 * ?changed=true -> layoutId starts as "initial" and is set to "shared" after mount.
 * ?changed=false -> layoutId is "shared" from the start (control).
 */
export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const changed = params.get("changed") !== "false"
    const [layoutId, setLayoutId] = useState(changed ? "initial" : "shared")
    const [showB, setShowB] = useState(false)

    const late = params.get("late") === "true"
    useEffect(() => {
        if (!late) setLayoutId("shared")
    }, [])

    const transition = {
        type: "tween" as const,
        ease: "linear" as const,
        duration: 10,
    }

    return (
        <div style={{ position: "relative", width: 600, height: 400 }}>
            <button id="toggle" onClick={() => setShowB(true)}>
                toggle
            </button>
            <button id="change" onClick={() => setLayoutId("shared")}>
                change
            </button>
            <span id="current-id">{layoutId}</span>
            {!showB ? (
                <motion.div
                    key="a"
                    id="a"
                    layoutId={layoutId}
                    transition={transition}
                    style={{
                        position: "absolute",
                        top: 50,
                        left: 0,
                        width: 100,
                        height: 100,
                        background: "red",
                    }}
                />
            ) : (
                <motion.div
                    key="b"
                    id="b"
                    layoutId={params.get("bid") || "shared"}
                    transition={transition}
                    style={{
                        position: "absolute",
                        top: 50,
                        left: 400,
                        width: 100,
                        height: 100,
                        background: "blue",
                    }}
                />
            )}
        </div>
    )
}
