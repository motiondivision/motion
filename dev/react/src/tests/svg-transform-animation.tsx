import { useState } from "react"
import { motion } from "framer-motion"

/**
 * Test for issue #3081: SVG transform animations should work
 * even when other SVG attributes are not also animated.
 */
export function App() {
    const [animate, setAnimate] = useState(false)

    return (
        <>
            <motion.svg
                id="svg-root"
                width={200}
                height={200}
                initial={
                    animate
                        ? undefined
                        : { rotate: 10 }
                }
                animate={
                    animate
                        ? { rotate: 0 }
                        : undefined
                }
                transition={{ duration: 0.1, ease: "linear" }}
            >
                <motion.g
                    id="svg-g"
                    transition={{ duration: 0.1, ease: "linear" }}
                    initial={
                        animate
                            ? undefined
                            : {
                                  transform: "matrix(1,0,0,1, 50, 50)",
                                  stroke: "#ff0000",
                              }
                    }
                    animate={
                        animate
                            ? {
                                  transform: "matrix(1, 0, 0, 1, 0, 0)",
                                  stroke: "#00ffff",
                              }
                            : undefined
                    }
                >
                    <motion.rect
                        id="svg-rect"
                        x={0}
                        y={0}
                        width={30}
                        height={30}
                        strokeWidth="5px"
                        initial={
                            animate
                                ? undefined
                                : {
                                      transform: "matrix(2,0,0,2, 0, 0)",
                                      fill: "#ffff00",
                                  }
                        }
                        animate={
                            animate
                                ? {
                                      transform: "matrix(1, 0, 0, 1, 0, 0)",
                                      fill: "#ff00ff",
                                  }
                                : undefined
                        }
                        transition={{ duration: 0.1, ease: "linear" }}
                    />
                </motion.g>
            </motion.svg>
            <button id="animate" onClick={() => setAnimate(true)}>
                Animate
            </button>
        </>
    )
}
