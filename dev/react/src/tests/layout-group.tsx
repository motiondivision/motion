import { LayoutGroup, motion, MotionConfig, Transition } from "framer-motion"
import { Fragment, useId, useState } from "react"

const transition: Transition = {
    layout: {
        type: "tween",
        duration: 0.2,
    },
}

export function App() {
    const [visible, setVisible] = useState(false)
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                height: "100vh",
            }}
        >
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    alignItems: "center",
                    height: "100vh",
                    width: "500px",
                }}
            >
                {visible && (
                    <div
                        style={{
                            backgroundColor: "green",
                            width: 100,
                            height: 100,
                        }}
                    />
                )}
                <LayoutGroup>
                    <MotionConfig transition={transition}>
                        <motion.div id="expander-wrapper" layout="position">
                            <Expander />
                        </motion.div>
                        <motion.div
                            id="text-wrapper"
                            layout="position"
                            style={{
                                display: "flex",
                                gap: 4,
                                alignItems: "center",
                            }}
                        >
                            some text
                            <LayoutGroup inherit="id">
                                <Button
                                    onClick={() =>
                                        setVisible((current) => !current)
                                    }
                                />
                            </LayoutGroup>
                        </motion.div>
                    </MotionConfig>
                </LayoutGroup>
            </div>
        </div>
    )
}

const Variants = motion.create(Fragment)

function Expander() {
    const [expanded, setExpanded] = useState(false)
    const id = useId()
    return (
        <Variants>
            <motion.div
                id="expander"
                layoutId={id}
                onClick={() => setExpanded((current) => !current)}
                style={{
                    height: expanded ? 100 : 25,
                    backgroundColor: "red",
                    marginBottom: 4,
                    cursor: "pointer",
                }}
                transition={{ type: "tween" }}
            >
                {expanded ? "collapse" : "expand"} me
            </motion.div>
        </Variants>
    )
}

function Button({ onClick }: { onClick?: VoidFunction }) {
    const id = useId()

    return (
        <motion.div
            id="button"
            layoutId={id}
            style={{
                background: "blue",
                color: "white",
                borderRadius: 8,
                padding: 10,
                cursor: "pointer",
            }}
            onClick={onClick}
        >
            Add child
        </motion.div>
    )
}
