import { animate, motion, useMotionValue } from "framer-motion"
import { useEffect, useState } from "react"

/**
 * Independent transforms on motion components, for
 * tests/react/independent-transforms.spec.ts. Values Motion creates are
 * composed into one accelerated WAAPI transform animation, unless
 * something needs them on the main thread.
 */
const transition = { duration: 1, ease: "linear" } as const

const box = {
    width: 100,
    height: 50,
    background: "#0077ff",
}

;(window as any).countTransformAnimations = (id: string) =>
    document
        .getElementById(id)!
        .getAnimations()
        .filter((animation) =>
            (animation.effect as KeyframeEffect)
                .getKeyframes()
                .some((keyframe) => "transform" in keyframe)
        ).length

export const App = () => {
    const [isWide, setIsWide] = useState(false)
    const externalX = useMotionValue(0)

    useEffect(() => {
        const timeout = setTimeout(() => setIsWide(true), 300)
        const animation = animate(externalX, 100, transition)
        return () => {
            clearTimeout(timeout)
            animation.stop()
        }
    }, [])

    return (
        <>
            <motion.div
                id="accelerated"
                style={box}
                animate={{ x: 100, scale: 1.5 }}
                transition={transition}
                whileHover={{ rotate: 45 }}
            />
            <motion.div
                id="template"
                style={box}
                animate={{ x: 100 }}
                transition={transition}
                transformTemplate={(_, generated) => generated}
            />
            <motion.div
                id="late-template"
                style={box}
                animate={{ x: 100 }}
                transition={transition}
                transformTemplate={
                    isWide
                        ? (_, generated) => generated + " rotate(45deg)"
                        : undefined
                }
            />
            <motion.div
                id="on-update"
                style={box}
                animate={{ x: 100 }}
                transition={transition}
                onUpdate={() => {}}
            />
            <motion.div
                id="external"
                style={{ ...box, x: externalX }}
                animate={{ scale: 1.5 }}
                transition={transition}
            />
            <motion.div
                id="layout"
                layout
                style={{ ...box, width: isWide ? 200 : 100 }}
                animate={{ x: 100 }}
                transition={{ x: transition, layout: { duration: 0.2 } }}
            />
        </>
    )
}
