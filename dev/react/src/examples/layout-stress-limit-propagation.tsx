import { motion, MotionConfig } from "framer-motion"
import * as React from "react"
import { useState } from "react"

function Group({ children }: React.PropsWithChildren) {
    return (
        <motion.div
            layout
            style={{
                backgroundColor: "hsla(0, 50%, 50%)",
                position: "relative",
                width: "var(--width)",
                height: "var(--height)",
                display: "flex",
            }}
        >
            <motion.div
                layout
                style={{
                    backgroundColor: "hsla(20, 50%, 50%)",
                    width: "100px",
                    height: "100px",
                    position: "absolute",
                    top: "0px",
                    left: "0px",
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
            <motion.div
                layout
                style={{
                    backgroundColor: "hsla(90, 50%, 50%)",
                    width: "100px",
                    height: "100px",
                }}
            >
                {children}
            </motion.div>
            <motion.div
                layout
                style={{
                    backgroundColor: "hsla(120, 50%, 50%)",
                    width: "100px",
                    height: "100px",
                    position: "absolute",
                    top: "0px",
                    left: "0px",
                }}
            />
            <motion.div
                layout
                style={{
                    backgroundColor: "hsla(170, 50%, 50%)",
                    width: "100px",
                    height: "100px",
                    position: "absolute",
                    top: "0px",
                    left: "0px",
                }}
            >
                <motion.div
                    layout
                    style={{
                        backgroundColor: "hsla(220, 50%, 50%)",
                        width: "100px",
                        height: "100px",
                        position: "absolute",
                        top: "0px",
                        left: "0px",
                    }}
                />
                <motion.div
                    layout
                    style={{
                        backgroundColor: "hsla(260, 50%, 50%)",
                        width: "100px",
                        height: "100px",
                        position: "absolute",
                        top: "0px",
                        left: "0px",
                    }}
                >
                    <motion.div
                        layout
                        style={{
                            backgroundColor: "hsla(300, 50%, 50%)",
                            width: "100px",
                            height: "100px",
                            position: "absolute",
                            top: "0px",
                            left: "0px",
                        }}
                    >
                        {children}
                    </motion.div>
                </motion.div>
            </motion.div>
        </motion.div>
    )
}

export const App = () => {
    const [expanded, setExpanded] = useState(false)

    const containerStyles = {
        "--width": "200px",
        "--height": "200px",
        "--offset": expanded ? "100px" : "0px",
        width: expanded ? "500px" : "1000px",
        height: "4000px",
        overflow: "hidden",
        position: "fixed" as const,
        top: 0,
        left: 0,
    }

    return (
        <MotionConfig transition={{ duration: 2 }}>
            <motion.div
                data-layout
                style={containerStyles}
                onClick={() => {
                    setExpanded(!expanded)
                }}
                layout
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
            </motion.div>
        </MotionConfig>
    )
}
