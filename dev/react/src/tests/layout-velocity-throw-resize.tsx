import { motion } from "framer-motion"
import { useState } from "react"

/**
 * A card thrown with drag becomes a wider detail view with the same
 * layoutId. The throw carries on into the detail view's position, but its
 * width must only travel from the card's width to its own: never shrink
 * below the card, grow past the detail view or turn inside out.
 */
export const App = () => {
    const [isOpen, setIsOpen] = useState(false)

    return isOpen ? (
        <motion.div
            key="detail"
            id="box"
            layoutId="card"
            style={{
                position: "absolute",
                top: 400,
                left: 50,
                width: 400,
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
