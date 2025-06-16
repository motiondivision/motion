import { motion } from "framer-motion"
import { useRef, useState } from "react"

const styleA = {
    width: 200,
    height: 200,
    background: "white",
    borderRadius: 20,
}

export const App = () => {
    const ref = useRef(null)
    const [isTap, setTap] = useState(false)
    const [isDrag, setDrag] = useState(false)
    const [isHover, setHover] = useState(false)
    const [dragCount, setDragCount] = useState(0)

    return (
        <motion.div
            drag
            dragConstraints={{ left: 0, right: 100, top: 0, bottom: 100 }}
            ref={ref}
            dragElastic={0}
            whileTap={{ scale: 0.95 }}
            onTap={() => setTap(false)}
            onTapStart={() => setTap(true)}
            onTapCancel={() => setTap(false)}
            onDrag={() => setDragCount(dragCount + 1)}
            onDragStart={() => setDrag(true)}
            onDragEnd={() => setDrag(false)}
            onHoverStart={() => {
                console.log("hover start")
                setHover(true)
            }}
            onHoverEnd={() => {
                console.log("hover end")
                setHover(false)
            }}
            style={styleA}
        />
    )
}
