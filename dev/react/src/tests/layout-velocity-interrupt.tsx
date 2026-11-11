import { motion } from "framer-motion"
import { useState } from "react"

/**
 * A layout animation interrupted mid-flight. A spring starts with the box's
 * current velocity, so the box keeps moving right for a few frames before it
 * turns back.
 *
 * ?tween uses a tween, which takes no velocity and starts from rest.
 * ?duration uses a duration spring, which also starts from rest.
 * ?mirror repeats the spring once as a mirror, so the box goes back.
 */
export const App = () => {
    const [isRight, setIsRight] = useState(false)
    const params = new URLSearchParams(window.location.search)

    return (
        <motion.div
            id="box"
            layout
            transition={
                params.has("tween")
                    ? { duration: 0.8 }
                    : params.has("duration")
                    ? { type: "spring", duration: 0.8, bounce: 0 }
                    : {
                          type: "spring",
                          visualDuration: params.has("mirror") ? 0.3 : 0.8,
                          bounce: 0,
                          ...(params.has("mirror") && {
                              repeat: 1,
                              repeatType: "mirror",
                          }),
                      }
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
