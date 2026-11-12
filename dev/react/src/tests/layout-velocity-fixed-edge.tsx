import { motion } from "framer-motion"
import { useState } from "react"

/**
 * The box grows to the right from a fixed left edge. When the animation is
 * interrupted, the new spring starts with the box's velocity, but the left
 * edge doesn't move in either layout, so it must stay put.
 *
 * ?tween uses a tween, which takes no velocity. ?delay waits 0.3s before
 * each spring starts.
 */
export const App = () => {
    const [isWide, setIsWide] = useState(false)
    const params = new URLSearchParams(window.location.search)

    return (
        <motion.div
            id="box"
            layout
            transition={
                params.has("tween")
                    ? { duration: 0.8 }
                    : {
                          type: "spring",
                          visualDuration: 0.8,
                          bounce: 0,
                          delay: params.has("delay") ? 0.3 : 0,
                      }
            }
            onClick={() => setIsWide(!isWide)}
            style={{
                position: "absolute",
                top: 100,
                left: 100,
                width: isWide ? 500 : 100,
                height: 100,
                background: "red",
            }}
        />
    )
}
