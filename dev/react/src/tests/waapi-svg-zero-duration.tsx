import { motion } from "framer-motion"
import { useState } from "react"

export const App = () => {
    const [hidden, setHidden] = useState(false)

    /**
     * Mark which animation last completed so the test can wait for it
     * rather than for a fixed delay, which flakes when frames are late.
     */
    const onComplete = (id: string) => () => {
        document.getElementById(id)!.dataset.complete = hidden
            ? "hidden"
            : "visible"
    }

    return (
        <>
            <button id="toggle" onClick={() => setHidden(!hidden)}>
                toggle
            </button>
            <svg height={140} width={200}>
                <motion.foreignObject
                    id="chip"
                    animate={{ opacity: hidden ? 0 : 1 }}
                    height={40}
                    initial={false}
                    onAnimationComplete={onComplete("chip")}
                    transition={
                        hidden
                            ? { duration: 0.3 }
                            : { duration: 0.3, opacity: { duration: 0 } }
                    }
                    width={100}
                    x={10}
                    y={10}
                >
                    <div style={{ background: "red" }}>chip</div>
                </motion.foreignObject>
                <motion.rect
                    id="transform-target"
                    animate={{
                        transform: hidden
                            ? "translateX(50px)"
                            : "translateX(0px)",
                    }}
                    height={40}
                    initial={false}
                    onAnimationComplete={onComplete("transform-target")}
                    transition={
                        hidden
                            ? { duration: 0.3 }
                            : { duration: 0.3, transform: { duration: 0 } }
                    }
                    width={40}
                    x={120}
                    y={10}
                />
                <motion.circle
                    id="clip-path-target"
                    animate={{
                        clipPath: hidden ? "circle(0%)" : "circle(50%)",
                    }}
                    cx={30}
                    cy={100}
                    initial={false}
                    onAnimationComplete={onComplete("clip-path-target")}
                    r={20}
                    transition={
                        hidden
                            ? { duration: 0.3 }
                            : { duration: 0.3, clipPath: { duration: 0 } }
                    }
                />
                <motion.rect
                    id="filter-target"
                    animate={{
                        filter: hidden ? "blur(5px)" : "blur(0px)",
                    }}
                    height={40}
                    initial={false}
                    onAnimationComplete={onComplete("filter-target")}
                    transition={
                        hidden
                            ? { duration: 0.3 }
                            : { duration: 0.3, filter: { duration: 0 } }
                    }
                    width={40}
                    x={70}
                    y={80}
                />
            </svg>
        </>
    )
}
