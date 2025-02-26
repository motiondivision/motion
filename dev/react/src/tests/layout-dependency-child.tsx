import { AnimatePresence, motion, Variants } from "framer-motion"
import React from "react"

export function App() {
    const [divState, setDivState] = React.useState(false)
    const [animating, setAnimating] = React.useState(false)
    const [transitionId, setTransitionId] = React.useState(0)

    const duration = 10
    const commonVariant = {
        position: "absolute",
        boxSizing: "border-box",
        left: 25,
        width: 100,
        height: 25,
        backgroundColor: "blue",
    } as const

    const variants: Variants = {
        visible: {
            opacity: 1,
            ...commonVariant,
        },
        hidden: {
            opacity: 0,
            ...commonVariant,
        },
    }

    const deps = {
        layoutDependency: animating ? transitionId : -1,
    }

    return (
        <>
            <motion.div
                {...deps}
                layout
                onAnimationComplete={() => setAnimating(false)}
                className={divState ? "outerAnimate" : "outer"}
                transition={{ duration, ease: () => 0.5 }}
            >
                <AnimatePresence>
                    {!divState ? (
                        <motion.div
                            layout
                            id="child"
                            {...deps}
                            variants={variants}
                            animate="visible"
                            exit="hidden"
                            initial="hidden"
                            transition={{ duration, ease: () => 0.5 }}
                        />
                    ) : null}
                </AnimatePresence>
            </motion.div>

            <button
                style={{ position: "absolute", right: 10, top: 10 }}
                onClick={() => {
                    setDivState(!divState)
                    setTransitionId(transitionId + 1)
                    setAnimating(true)
                }}
            >
                Animate
            </button>
            <style>
                {`
                .outer {
                    width: 200px;
                    height: 100px;
                    top: 10px;
                    left: 10px;
                    position: absolute;
                    background-color: red;
                    overflow: visible;
                }

                .outerAnimate {
                    /* Height and width are the only things that's changing */
                    width: 100px;
                    height: 75px;
                    top: 10px;
                    left: 10px;
                    position: absolute;
                    background-color: red;
                    overflow: visible;
                }

                .border {
                    /* Border div has inset: 0 so should follow the size of its parent (outer/outerAnimate) */
                    inset: 0;
                    position: absolute;
                    box-sizing: border-box;
                }
`}
            </style>
        </>
    )
}
