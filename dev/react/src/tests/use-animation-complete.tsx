import { motion, useAnimationComplete } from "framer-motion"
import { useLayoutEffect, useRef, useState } from "react"

function DrawerContent() {
    const containerRef = useRef<HTMLDivElement>(null)
    const [leftOffset, setLeftOffset] = useState<number | null>(null)
    const [completedOffset, setCompletedOffset] = useState<number | null>(null)

    useLayoutEffect(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect()
            setLeftOffset(rect.left)
        }
    }, [])

    useAnimationComplete(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect()
            setCompletedOffset(rect.left)
        }
    })

    return (
        <div ref={containerRef}>
            <div id="initial-offset" data-offset={leftOffset}>
                {leftOffset}
            </div>
            <div id="completed-offset" data-offset={completedOffset}>
                {completedOffset}
            </div>
        </div>
    )
}

export function App() {
    return (
        <div style={{ padding: 40 }}>
            <motion.div
                initial={{ x: 300 }}
                animate={{ x: 0 }}
                transition={{ duration: 0.3, ease: "linear" }}
                style={{ padding: 40 }}
            >
                <DrawerContent />
            </motion.div>
        </div>
    )
}
