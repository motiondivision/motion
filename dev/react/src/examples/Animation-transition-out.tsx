import { motion } from "framer-motion"
import { useEffect, useState } from "react"

/**
 * An example of the tween transition type
 */

const style = {
    width: 100,
    height: 100,
    background: "white",
}
export const App = () => {
    const [state, setState] = useState(false)
    useEffect(() => {
        setTimeout(() => {
            setState(true)
        }, 300)
    }, [state])

    return (
        <motion.div
            animate={{ scale: 1, transition: { duration: 1 } }}
            whileHover={{ scale: 1.1, transition: { duration: 1 } }}
            whileTap={{ scale: 0.9, transition: { out: true, type: false } }}
            style={style}
        />
    )
}
