import { animate, motion } from "framer-motion"
import { useState } from "react"

export const App = () => {
    const [expanded, setExpanded] = useState(false)
    const transition = { duration: 4, ease: "linear" as const }
    const style = {
        width: expanded ? 200 : 100,
        height: expanded ? 160 : 80,
        borderRadius: 20,
        background: "red",
    }

    return (
        <>
            <button
                id="animate"
                onClick={() => {
                    const numericAnimation = animate(
                        "#numeric",
                        {
                            width: [100, 200],
                            height: [80, 160],
                            borderRadius: [20, 40],
                        },
                        { duration: 1, ease: "linear", autoplay: false }
                    )
                    Object.assign(window, { numericAnimation })
                }}
            >
                Animate
            </button>
            <div
                id="numeric"
                style={{ width: 100, height: 80, borderRadius: 20 }}
            />
            <button id="layout" onClick={() => setExpanded(!expanded)}>
                Layout
            </button>
            <motion.div
                id="own-layout"
                layout
                initial={false}
                animate={{ borderRadius: expanded ? 40 : 20 }}
                style={style}
                transition={transition}
            />
            <motion.div
                id="shared-layout"
                layoutId="numeric-shared"
                initial={false}
                animate={{ borderTopLeftRadius: expanded ? 40 : 20 }}
                style={style}
                transition={transition}
            />
            <motion.div
                layout
                style={{ width: expanded ? 400 : 200 }}
                transition={transition}
            >
                <motion.div
                    id="nested-layout"
                    layout
                    initial={false}
                    animate={{ borderRadius: expanded ? 40 : 20 }}
                    style={{ ...style, width: "50%" }}
                    transition={transition}
                />
            </motion.div>
        </>
    )
}
