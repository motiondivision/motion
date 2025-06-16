import { AnimatePresence, motion, MotionConfig } from "framer-motion"
import { useState } from "react"

export const App = () => {
    const [state, setState] = useState(false)

    return (
        <MotionConfig transition={{ duration: 10, ease: (p) => 0.25 }}>
            <div style={{ display: "flex", gap: 100 }}>
                <motion.div
                    layoutId="box"
                    style={{ width: 100, height: 100, background: "red" }}
                />
                <AnimatePresence>
                    {state && (
                        <motion.div
                            id="box"
                            layoutId="box"
                            layoutCrossfade={false}
                            style={{
                                width: 100,
                                height: 100,
                                background: "blue",
                            }}
                        />
                    )}
                </AnimatePresence>
            </div>
            <button onClick={() => setState(!state)}>Toggle</button>
        </MotionConfig>
    )
}
