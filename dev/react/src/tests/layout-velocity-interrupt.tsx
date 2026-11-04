import { motion } from "framer-motion"
import { useState } from "react"

/**
 * A layout animation interrupted mid-flight. A spring starts with the box's
 * current velocity, so the box keeps moving right for a few frames before it
 * turns back.
 *
 * ?tween uses a tween, which takes no velocity and starts from rest.
 */
export const App = () => {
    const [isRight, setIsRight] = useState(false)

    return (
        <motion.div
            id="box"
            layout
            transition={
                new URLSearchParams(window.location.search).has("tween")
                    ? { duration: 0.8 }
                    : { type: "spring", visualDuration: 0.8, bounce: 0 }
            }
            onClick={() => setIsRight(!isRight)}
            style={{
                position: "absolute",
                top: 100,
                left: isRight ? 500 : 100,
                width: 100,
                height: 100,
                background: "red",
            }}
        />
    )
}
