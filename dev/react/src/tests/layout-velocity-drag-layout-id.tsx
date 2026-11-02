import { motion, MotionGlobalConfig } from "framer-motion"
import { useState } from "react"

/**
 * A card thrown with drag becomes a detail view with the same layoutId.
 * The detail view sits down and to the left of the card. With
 * layoutVelocity on, the detail view starts with the throw velocity, so it
 * keeps moving right for a few frames before it travels to its own layout.
 *
 * ?velocity=false turns the flag off. The flag is set while rendering, as
 * the React 18 app imports every test page up front.
 */

const transition = { type: "spring", visualDuration: 0.8, bounce: 0 } as const

export const App = () => {
    MotionGlobalConfig.layoutVelocity =
        new URLSearchParams(window.location.search).get("velocity") !== "false"
    const [isOpen, setIsOpen] = useState(false)

    return isOpen ? (
        <motion.div
            key="detail"
            id="box"
            layoutId="card"
            transition={transition}
            style={{
                position: "absolute",
                top: 400,
                left: 50,
                width: 100,
                height: 100,
                background: "blue",
            }}
        />
    ) : (
        <motion.div
            key="card"
            id="box"
            layoutId="card"
            drag
            transition={transition}
            onDragEnd={() => setIsOpen(true)}
            style={{
                position: "absolute",
                top: 100,
                left: 300,
                width: 100,
                height: 100,
                background: "red",
            }}
        />
    )
}
