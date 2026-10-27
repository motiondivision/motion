import { LayoutGroup, motion } from "framer-motion"
import { useEffect, useState } from "react"

/**
 * #4022: a sibling's layout update mustn't distort an element looping a
 * 3D rotation. Used by tests/react/layout-sibling-rotating-3d.spec.ts.
 *
 * With ?later, the rotation starts when window.spin() is called rather than
 * on mount, so it's still on the compositor after Strict Mode's remount.
 */
const startsLater = new URLSearchParams(window.location.search).has("later")

function Button() {
    const [hover, setHover] = useState(false)

    return (
        <motion.button
            id="button"
            layoutId="button"
            layoutDependency={hover}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                position: "absolute",
                left: 600,
                top: 500,
                width: 140,
                height: 40,
            }}
        >
            Hover me
        </motion.button>
    )
}

export const App = () => {
    const [isSpinning, setIsSpinning] = useState(!startsLater)

    useEffect(() => {
        ;(window as any).spin = () => setIsSpinning(true)
    }, [])

    return (
        <LayoutGroup>
            <motion.div
                layoutId="hero"
                style={{ position: "relative", width: 900, height: 650 }}
            >
                <motion.div
                    id="pack"
                    layoutId="pack"
                    style={{
                        position: "absolute",
                        left: 300,
                        top: 100,
                        width: 200,
                        height: 300,
                        background: "violet",
                        rotate: -12,
                        rotateX: -12,
                        transformPerspective: 962,
                        z: -80,
                        transformStyle: "preserve-3d",
                    }}
                    initial={{ rotateY: 0 }}
                    animate={{ rotateY: isSpinning ? 360 : 0 }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "linear",
                    }}
                />
                <Button />
            </motion.div>
        </LayoutGroup>
    )
}
