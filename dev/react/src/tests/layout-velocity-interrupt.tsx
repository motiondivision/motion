import { motion, MotionGlobalConfig } from "framer-motion"
import { useState } from "react"

/**
 * A layout animation interrupted mid-flight. With layoutVelocity on, the
 * new animation starts with the box's current velocity, so the box keeps
 * moving right for a few frames before it turns back.
 *
 * ?velocity=false turns the flag off. The flag is set while rendering, as
 * the React 18 app imports every test page up front.
 */
export const App = () => {
    MotionGlobalConfig.layoutVelocity =
        new URLSearchParams(window.location.search).get("velocity") !== "false"
    const [isRight, setIsRight] = useState(false)

    return (
        <motion.div
            id="box"
            layout
            transition={{ type: "spring", visualDuration: 0.8, bounce: 0 }}
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
