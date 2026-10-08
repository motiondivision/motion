import { motion } from "framer-motion"
import { useState } from "react"

/**
 * A draggable element without `layout` that grows when grabbed should grow
 * from where it is, rather than jumping to keep its centre in place.
 */
export const App = () => {
    const [wide, setWide] = useState(false)
    return (
        <motion.div
            id="box"
            drag
            dragMomentum={false}
            onDragStart={() => setWide(true)}
            style={{
                position: "absolute",
                top: 100,
                left: 100,
                width: wide ? 300 : 100,
                height: 100,
                background: "red",
            }}
        />
    )
}
