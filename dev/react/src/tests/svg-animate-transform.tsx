"use client"

import { animate, motion } from "framer-motion"
import { useEffect, useRef } from "react"

export function App() {
    const pathRef = useRef<SVGPathElement>(null)

    useEffect(() => {
        if (!pathRef.current) return

        animate(
            pathRef.current,
            {
                x: 5,
                y: 5,
            },
            { duration: 0.01 }
        )
    }, [])

    return (
        <div>
            <motion.div
                style={{
                    ...container,
                    background:
                        "linear-gradient(180deg, #7700ff 0%, rgb(68, 0, 255) 100%)",
                }}
            >
                <motion.div
                    className="icon-container"
                    style={{ ...box }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.5}
                >
                    <svg className="progress-icon" viewBox="0 0 50 50">
                        <motion.path
                            ref={pathRef}
                            fill="none"
                            strokeWidth="2"
                            stroke="rgb(68, 0, 255)"
                            style={{
                                x: 5,
                                y: 5,
                            }}
                            d="M 0, 20 a 20, 20 0 1,0 40,0 a 20, 20 0 1,0 -40,0"
                        />
                    </svg>
                </motion.div>
            </motion.div>
        </div>
    )
}

/**
 * ==============   Styles   ================
 */

const box = {
    width: 140,
    height: 140,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
}

const container: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
    width: 500,
    height: 300,
    maxWidth: "100%",
    borderRadius: 20,
}
