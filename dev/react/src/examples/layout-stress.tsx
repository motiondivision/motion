import { motion, MotionConfig } from "framer-motion"
import * as React from "react"
import { useState } from "react"

const containerStyles = {
    display: "flex",
    flexWrap: "wrap",
    width: "1000px",
    height: "4000px",
    overflow: "hidden",
    justifyContent: "flex-start",
    alignItems: "flex-start",
}

const baseStyles = {
    width: "200px",
    height: "200px",
}

const expandedStyles = {
    width: "500px",
    height: "500px",
}

const baseOffset = "10px"
const expandedOffset = "100px"

function Group({ children }: React.PropsWithChildren) {
    return (
        <motion.div
            layout
            style={{
                ...baseStyles,
                backgroundColor: "hsla(0, 50%, 50%)",
                position: "relative",
                display: "flex",
            }}
        >
            <motion.div
                layout
                style={{
                    ...baseStyles,
                    backgroundColor: "hsla(20, 50%, 50%)",
                    position: "absolute",
                    top: baseOffset,
                    left: baseOffset,
                }}
            />
            <motion.div
                layout
                style={{
                    width: baseOffset,
                    height: baseOffset,
                    backgroundColor: "hsla(60, 50%, 50%)",
                }}
            />
            <motion.div
                layout
                style={{
                    width: baseOffset,
                    height: baseOffset,
                    backgroundColor: "hsla(90, 50%, 50%)",
                }}
            >
                {children}
            </motion.div>
            <motion.div
                layout
                style={{
                    ...baseStyles,
                    backgroundColor: "hsla(120, 50%, 50%)",
                    position: "absolute",
                    top: baseOffset,
                    left: baseOffset,
                }}
            />
            <motion.div
                layout
                style={{
                    ...baseStyles,
                    backgroundColor: "hsla(170, 50%, 50%)",
                    position: "absolute",
                    top: baseOffset,
                    left: baseOffset,
                }}
            >
                <motion.div
                    layout
                    style={{
                        ...baseStyles,
                        backgroundColor: "hsla(220, 50%, 50%)",
                        position: "absolute",
                        top: baseOffset,
                        left: baseOffset,
                    }}
                />
                <motion.div
                    layout
                    style={{
                        ...baseStyles,
                        backgroundColor: "hsla(260, 50%, 50%)",
                        position: "absolute",
                        top: baseOffset,
                        left: baseOffset,
                    }}
                >
                    <motion.div
                        layout
                        style={{
                            ...baseStyles,
                            backgroundColor: "hsla(300, 50%, 50%)",
                            position: "absolute",
                            top: baseOffset,
                            left: baseOffset,
                        }}
                    />
                </motion.div>
            </motion.div>
        </motion.div>
    )
}

export const App = () => {
    const [expanded, setExpanded] = useState(false)

    return (
        <MotionConfig transition={{ duration: 10, ease: "linear" }}>
            <div
                data-layout
                style={{
                    ...containerStyles,
                    ...(expanded
                        ? {
                              "--width": "500px",
                              "--height": "500px",
                              "--offset": "100px",
                          }
                        : {
                              "--width": "200px",
                              "--height": "200px",
                              "--offset": "10px",
                          }),
                }}
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
