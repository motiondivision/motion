import { motion } from "framer-motion"
import { useRef, useState } from "react"

/**
 * A layout animation with no transition set runs a soft physics spring, not
 * a 0.45s tween. The spring settles later than 0.45s, so the page writes how
 * long the animation took.
 *
 * ?tween sets an explicit 0.45s tween, which stays a tween.
 */
export const App = () => {
    const transition = new URLSearchParams(window.location.search).has("tween")
        ? { duration: 0.45 }
        : undefined
    const [isRight, setIsRight] = useState(false)
    const startedAt = useRef(0)
    const [duration, setDuration] = useState<number | null>(null)

    return (
        <motion.div
            id="box"
            layout
            transition={transition}
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
