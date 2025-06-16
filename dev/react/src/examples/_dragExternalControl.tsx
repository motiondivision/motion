import { useState } from "react"
import { motion } from "framer-motion"

const style = {
    width: 300,
    height: 300,
    background: "white",
    borderRadius: "10px",
}

export const App = () => {
    const [dragOriginEvent, setDragOriginEvent] = useState<Event | null>(null)

    return (
        <motion.div
            dragOriginEvent={dragOriginEvent}
            drag="x"
            dragConstraints={{ left: -100, right: 100 }}
        >
            <motion.div
                style={style}
                onTapStart={(e) => setDragOriginEvent(e)}
                onTapCancel={() => setDragOriginEvent(null)}
                onTap={() => setDragOriginEvent(null)}
            />
            <motion.div
                style={style}
                onTapStart={(e) => setDragOriginEvent(e)}
                onTapCancel={() => setDragOriginEvent(null)}
                onTap={() => setDragOriginEvent(null)}
            />
        </motion.div>
    )
}
