import { motion } from "framer-motion"
import { useEffect, useState } from "react"

/**
 * #4022: a child's layout update mustn't be measured inside an ancestor
 * that's still rotated on the compositor. Used by
 * tests/react/layout-sibling-rotating-3d.spec.ts.
 *
 * The rotation starts when window.spin() is called, so it's still on the
 * compositor after Strict Mode's remount.
 */
function Child() {
    const [count, setCount] = useState(0)

    useEffect(() => {
        ;(window as any).rerender = () => setCount((n) => n + 1)
    }, [])

    return (
        <motion.div
            id="child"
            layout
            layoutDependency={count}
            style={{
                position: "absolute",
                left: 20,
                top: 20,
                width: 100,
                height: 100,
                background: "red",
            }}
        />
    )
}

export const App = () => {
    const [isSpinning, setIsSpinning] = useState(false)

    useEffect(() => {
        ;(window as any).spin = () => setIsSpinning(true)
    }, [])

    return (
        <motion.div
            id="pack"
            layout
            style={{
                position: "absolute",
                left: 300,
                top: 100,
                width: 200,
                height: 300,
                background: "violet",
                rotate: -12,
                transformPerspective: 962,
            }}
            initial={{ rotateY: 0 }}
            animate={{ rotateY: isSpinning ? 360 : 0 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        >
            <Child />
        </motion.div>
    )
}
