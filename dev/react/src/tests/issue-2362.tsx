import { motion } from "framer-motion"
import { useState } from "react"

/**
 * https://github.com/motiondivision/motion/issues/2362
 *
 * An element with a layoutId that's conditionally rendered into a different
 * parent. The shared layout animation should carry the element across, without
 * re-running the entering element's initial -> animate opacity animation.
 */
export const App = () => {
    const [active, setActive] = useState(0)

    return (
        <div style={{ display: "flex", gap: 100, padding: 50 }}>
            {[0, 1].map((index) => (
                <button
                    key={index}
                    id={`tab-${index}`}
                    onClick={() => setActive(index)}
                    style={{
                        position: "relative",
                        width: 100,
                        height: 50,
                    }}
                >
                    {`tab ${index}`}
                    {active === index && (
                        <motion.div
                            id="underline"
                            layoutId="underline"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{
                                duration: 2,
                                ease: "linear",
                                layout: { duration: 0.2 },
                            }}
                            style={{
                                position: "absolute",
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: 5,
                                backgroundColor: "#f00",
                            }}
                        />
                    )}
                </button>
            ))}
        </div>
    )
}
