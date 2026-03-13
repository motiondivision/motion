import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"

/**
 * Reproduces #3028: When a parent has a layout animation with an explicit
 * duration and a child also has layout with changing size, the child
 * bounces unexpectedly due to incorrect scale correction.
 *
 * Records min/max child width over the animation to detect bouncing.
 * Expected: child width stays between 40 and 60 (start and end).
 * Bug: child width goes outside this range (overshoots/bounces).
 */
export const App = () => {
    const [isOpen, setIsOpen] = useState(false)
    const childRef = useRef<HTMLDivElement>(null)
    const trackerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!isOpen) return

        let minW = Infinity
        let maxW = -Infinity
        let minH = Infinity
        let maxH = -Infinity
        let running = true

        const measure = () => {
            if (!running || !childRef.current || !trackerRef.current) return
            const bbox = childRef.current.getBoundingClientRect()
            if (bbox.width < minW) minW = bbox.width
            if (bbox.width > maxW) maxW = bbox.width
            if (bbox.height < minH) minH = bbox.height
            if (bbox.height > maxH) maxH = bbox.height
            trackerRef.current.dataset.minW = minW.toFixed(1)
            trackerRef.current.dataset.maxW = maxW.toFixed(1)
            trackerRef.current.dataset.minH = minH.toFixed(1)
            trackerRef.current.dataset.maxH = maxH.toFixed(1)
            requestAnimationFrame(measure)
        }
        requestAnimationFrame(measure)

        return () => {
            running = false
        }
    }, [isOpen])

    return (
        <>
            <div id="tracker" ref={trackerRef} />
            <motion.div
                id="parent"
                layout
                initial={{ borderRadius: 50 }}
                style={{
                    width: isOpen ? 400 : 100,
                    height: isOpen ? 200 : 100,
                    background: "white",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                }}
                onClick={() => setIsOpen(!isOpen)}
                transition={{ duration: 1 }}
            >
                <motion.div
                    id="child"
                    ref={childRef}
                    layout
                    style={{
                        width: isOpen ? 60 : 40,
                        height: isOpen ? 60 : 40,
                        background: "red",
                        borderRadius: "50%",
                    }}
                />
            </motion.div>
        </>
    )
}
