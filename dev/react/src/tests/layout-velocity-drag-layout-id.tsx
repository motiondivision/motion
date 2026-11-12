import { motion } from "framer-motion"
import { useState } from "react"

/**
 * A card thrown with drag becomes a detail view with the same layoutId.
 * The detail view sits down and to the left of the card. With a spring, the
 * detail view starts with the throw velocity, so it keeps moving right for a
 * few frames before it travels to its own layout.
 *
 * ?tween uses a tween, which takes no velocity and starts from rest.
 */

export const App = () => {
    const transition = new URLSearchParams(window.location.search).has("tween")
        ? { duration: 0.8 }
        : ({ type: "spring", visualDuration: 0.8, bounce: 0 } as const)
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
