/**
 * Page for tests/react/appear.spec.ts. The dev server renders it, and
 * appear-main.tsx hydrates it.
 */
import { MotionConfig, motion } from "motion/react"
import { appear } from "motion/react-appear"
import { useEffect, useState } from "react"
import type { PageProps } from "./page-props"

const linear = { type: "tween", ease: "linear", duration: 4 } as const
const box = { width: 100, height: 100, background: "#f00" }

/**
 * Its target changes soon after the page's code has loaded.
 */
const Changing = () => {
    const [x, setX] = useState(0)

    useEffect(() => {
        const timer = setTimeout(() => setX(200), 300)
        return () => clearTimeout(timer)
    }, [])

    return (
        <motion.div
            id="changing"
            initial={{ x: -400 }}
            animate={{ x }}
            transition={linear}
            style={box}
        />
    )
}

/**
 * Tells the tests that the page's code has loaded.
 */
const Hydrated = () => {
    useEffect(() => {
        document.body.dataset.code = "ready"
    }, [])

    return null
}

export const App = ({ url }: PageProps) => (
    <MotionConfig
        appear={url.includes("off") ? undefined : appear}
        reducedMotion={url.includes("reduced") ? "user" : undefined}
    >
        <motion.div
            id="independent"
            initial={{ x: -400, scale: 0.5 }}
            animate={{ x: 0, scale: 1 }}
            transition={{ x: linear, scale: { ...linear, duration: 1 } }}
            style={box}
        />
        <Changing />
        <motion.div
            id="tween"
            initial={{ opacity: 0, x: -400 }}
            animate={{ opacity: 1, x: 0 }}
            transition={linear}
            style={box}
        />
        <motion.div
            id="spring"
            initial={{ x: -400 }}
            animate={{ x: 0 }}
            style={box}
        />
        <motion.div
            id="colour"
            initial={{ backgroundColor: "#ff0000" }}
            animate={{ backgroundColor: "#0000ff" }}
            transition={linear}
            style={box}
        />
        <motion.div
            id="hover"
            initial={{ x: -400, scale: 0.5 }}
            animate={{ x: 0, scale: 1 }}
            whileHover={{ scale: 2 }}
            transition={linear}
            style={{ ...box, marginLeft: 500 }}
        />
        <Hydrated />
        {/*
         * CSS can't run keyframes. One such enter animation turns the
         * CSS enter animations of the whole page off.
         */}
        {url.includes("keyframes") && (
            <motion.div
                id="keyframes"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.5, 1] }}
                transition={linear}
                style={box}
            />
        )}
    </MotionConfig>
)
