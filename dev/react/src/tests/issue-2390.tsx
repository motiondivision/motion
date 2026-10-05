import { motion, useAnimation, useDragControls } from "framer-motion"
import { useEffect, useRef } from "react"

/**
 * Issue #2390: animating `y` to a CSS variable (`var(--slide-to)` -> "20%")
 * then dragging via dragControls should not jump or become unresponsive.
 */
export const App = () => {
    // ?hardcoded=true uses the resolved values instead of CSS variables (control)
    const hardcoded = new URLSearchParams(window.location.search).get(
        "hardcoded"
    )
    const slideTo = hardcoded ? "20%" : "var(--slide-to)"
    const slideFrom = hardcoded ? "120%" : "var(--slide-from)"
    const animationControls = useAnimation()
    const dragControls = useDragControls()
    const startY = useRef(0)

    useEffect(() => {
        animationControls.start({
            y: slideTo,
            transition: { duration: 0.3, type: "spring", bounce: 0.15 },
        })
    }, [animationControls, slideTo])

    return (
        <motion.div
            id="box"
            initial={{ y: slideFrom }}
            animate={animationControls}
            drag="y"
            dragElastic={0}
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            onDragStart={(_, info) => {
                startY.current = info.point.y
            }}
            onDragEnd={(_, info) => {
                if (info.point.y - startY.current > 100) {
                    animationControls.start({
                        y: slideFrom,
                        transition: { bounce: 0, duration: 0.2 },
                    })
                } else {
                    animationControls.start({ y: slideTo })
                }
            }}
            style={
                {
                    position: "fixed",
                    top: 0,
                    left: 0,
                    height: 400,
                    width: 300,
                    background: "lightblue",
                    "--slide-from": "120%",
                    "--slide-to": "20%",
                } as any
            }
        >
            <div
                id="handle"
                style={{
                    height: 96,
                    width: "100%",
                    background: "orange",
                    touchAction: "none",
                }}
                onPointerDown={(e) => dragControls.start(e)}
            />
        </motion.div>
    )
}
