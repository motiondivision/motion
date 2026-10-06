import { motion } from "framer-motion"
import { useEffect, useState } from "react"

/**
 * Starting scale while x is mid-flight must not rebuild or restart the
 * x animation. Both run as separate accelerated animations.
 */
export const App = () => {
    const [scale, setScale] = useState(1)

    useEffect(() => {
        const record = setTimeout(() => {
            ;(window as any).xAnimation = document
                .getElementById("box")!
                .getAnimations()[0]
        }, 500)
        const interrupt = setTimeout(() => setScale(2), 1000)

        return () => {
            clearTimeout(record)
            clearTimeout(interrupt)
        }
    }, [])

    return (
        <motion.div
            id="box"
            initial={{ x: 0, scale: 1 }}
            animate={{ x: 200, scale }}
            transition={{ type: "tween", ease: "linear", duration: 10 }}
            style={{
                width: 100,
                height: 100,
                margin: 200,
                background: "red",
            }}
        />
    )
}
