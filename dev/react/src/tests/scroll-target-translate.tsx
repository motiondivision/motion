import { motion, useScroll, useTransform } from "framer-motion"
import * as React from "react"
import { useRef } from "react"

/**
 * Regression test for #2914: useScroll target should account for CSS translate.
 *
 * The target div has transform: translateY(500px), pushing it 500px lower visually.
 * Without the fix, useScroll ignores the translate and reports incorrect progress.
 */
export const App = () => {
    const targetRef = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({
        target: targetRef,
        offset: ["start end", "end start"],
    })

    // Drive opacity from scroll progress so Cypress can read computed style
    const opacity = useTransform(scrollYProgress, [0, 1], [1, 0])

    return (
        <div>
            <div style={{ height: 1000 }} />
            <div
                ref={targetRef}
                id="target"
                style={{
                    height: 200,
                    width: 200,
                    background: "red",
                    transform: "translateY(500px)",
                }}
            >
                <motion.div
                    id="indicator"
                    style={{ width: 50, height: 50, background: "blue", opacity }}
                />
            </div>
            <div style={{ height: 3000 }} />
        </div>
    )
}
