import { motion, MotionGlobalConfig } from "framer-motion"
import { useRef, useState } from "react"

/**
 * With layoutVelocity on, a layout animation with no transition set runs a
 * physics spring instead of the 0.45s default tween. The spring settles
 * later than 0.45s, so the page writes how long the animation took.
 *
 * ?velocity=false turns the flag off.
 */
export const App = () => {
    MotionGlobalConfig.layoutVelocity =
        new URLSearchParams(window.location.search).get("velocity") !== "false"
    const [isRight, setIsRight] = useState(false)
    const startedAt = useRef(0)
    const [duration, setDuration] = useState<number | null>(null)

    return (
        <motion.div
            id="box"
            layout
            data-duration={duration ?? ""}
            onClick={() => setIsRight(!isRight)}
            onLayoutAnimationStart={() => {
                startedAt.current = performance.now()
            }}
            onLayoutAnimationComplete={() =>
                setDuration(performance.now() - startedAt.current)
            }
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
