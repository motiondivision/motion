import { m, LazyMotion, domAnimation } from "framer-motion"
import { useState, useEffect, useRef } from "react"

/**
 * Test for GitHub issue #2759
 * When LazyMotion features load asynchronously and state changes occur before
 * features load, the enter animation should still fire (not snap to final value).
 */

const variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
}

export const App = () => {
    const [isVisible, setIsVisible] = useState(false)
    const boxRef = useRef<HTMLDivElement>(null)

    // Simulate state change that occurs before features load
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(true)
        }, 5) // State changes after 5ms
        return () => clearTimeout(timer)
    }, [])

    return (
        <LazyMotion
            features={() =>
                new Promise((resolve) => {
                    // Features load after 50ms (longer than the 5ms state change)
                    setTimeout(() => {
                        resolve(domAnimation)
                    }, 50)
                })
            }
        >
            <m.div
                id="box"
                ref={boxRef}
                initial={false}
                animate={isVisible ? "visible" : "hidden"}
                variants={variants}
                transition={{ duration: 0.1 }}
                onAnimationComplete={() => {
                    if (boxRef.current) {
                        boxRef.current.dataset.animationComplete = "true"
                    }
                }}
                style={{
                    width: 100,
                    height: 100,
                    background: "red",
                }}
            />
        </LazyMotion>
    )
}
