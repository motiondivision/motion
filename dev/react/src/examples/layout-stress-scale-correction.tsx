import { motion, MotionConfig } from "framer-motion"
import * as React from "react"
import { useState } from "react"

function Group({ children }: React.PropsWithChildren) {
    return (
        <motion.div
            layout
            style={{
                width: "var(--width)",
                height: "var(--height)",
                backgroundColor: "hsla(0, 50%, 50%)",
                position: "relative",
                display: "flex",
            }}
        >
            <motion.div
                layout
                style={{
                    backgroundColor: "hsla(90, 50%, 50%)",
                    width: "100px",
                    height: "100px",
                }}
            >
                <motion.div
                    layout
                    style={{
                        backgroundColor: "hsla(20, 50%, 50%)",
                        width: "100px",
                        height: "100px",
                        position: "absolute",
                    }}
                />
                <motion.div
                    layout
                    style={{
                        backgroundColor: "hsla(60, 50%, 50%)",
                        width: "100px",
                        height: "100px",
                    }}
                />
                {children}
            </motion.div>
            <motion.div
                layout
                style={{
                    backgroundColor: "hsla(170, 50%, 50%)",
                    width: "100px",
                    height: "100px",
                    position: "absolute",
                }}
            >
                <motion.div
                    layout
                    style={{
                        backgroundColor: "hsla(220, 50%, 50%)",
                        width: "100px",
                        height: "100px",
                        position: "absolute",
                    }}
                />
                <motion.div
                    layout
                    style={{
                        backgroundColor: "hsla(260, 50%, 50%)",
                        position: "absolute",
                    }}
                >
                    <motion.div
                        layout
                        style={{
                            backgroundColor: "hsla(300, 50%, 50%)",
                            width: "100px",
                            height: "100px",
                            position: "absolute",
                            top: "var(--offset)",
                            left: "var(--offset)",
                        }}
                    />
                </motion.div>
            </motion.div>
        </motion.div>
    )
}

export const App = () => {
    const [expanded, setExpanded] = useState(false)

    const containerStyle = {
        display: "flex",
        flexWrap: "wrap" as const,
        "--width": expanded ? "500px" : "200px",
        "--height": expanded ? "500px" : "200px",
        "--offset": expanded ? "100px" : "0px",
        width: "1000px",
        height: "4000px",
        overflow: "hidden",
        justifyContent: "flex-start",
        alignItems: "flex-start",
    }

    return (
        <MotionConfig transition={{ duration: 2 }}>
            <div
                data-layout
                style={containerStyle}
                onClick={() => {
                    setExpanded(!expanded)
                }}
            >
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
                <Group>
                    <Group />
                </Group>
            </div>
        </MotionConfig>
    )
}
