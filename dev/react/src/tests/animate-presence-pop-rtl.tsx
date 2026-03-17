import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"

export const App = () => {
    const [state, setState] = useState(true)

    return (
        <div dir="rtl">
            <div
                id="container"
                style={{
                    display: "flex",
                    width: "fit-content",
                    position: "relative",
                }}
                onClick={() => setState(!state)}
            >
                <AnimatePresence mode="popLayout">
                    <motion.div
                        key="a"
                        id="a"
                        style={{
                            width: 100,
                            height: 100,
                            backgroundColor: "red",
                        }}
                    />
                    {state ? (
                        <motion.div
                            key="b"
                            id="b"
                            exit={{
                                opacity: 0,
                                transition: { duration: 10 },
                            }}
                            style={{
                                width: 100,
                                height: 100,
                                backgroundColor: "green",
                            }}
                        />
                    ) : null}
                </AnimatePresence>
            </div>
        </div>
    )
}
