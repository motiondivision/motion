import { motion, MotionConfig } from "framer-motion"
import * as React from "react"
import { useState } from "react"

/**
 * This stress test is designed to dirty transform at the top of the tree,
 * but only update layout at the leaves.
 */

function Group({
    children,
    expanded,
}: React.PropsWithChildren<{ expanded?: boolean }>) {
    return (
        <motion.div
            layout
            style={{
                backgroundColor: "hsla(0, 50%, 50%)",
                position: "relative",
                width: "100px",
                height: "200px",
                display: "flex",
            }}
            animate={{ x: expanded ? 100 : 0 }}
        >
            <motion.div
                layout
                style={{
                    backgroundColor: "hsla(20, 50%, 50%)",
                    width: "100px",
                    height: "200px",
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
                    height: "200px",
                }}
            />
            <motion.div
                layout
                style={{
                    backgroundColor: "hsla(90, 50%, 50%)",
                    width: "100px",
                    height: "200px",
                }}
            >
                {children}
            </motion.div>
            <motion.div
                layout
                style={{
                    backgroundColor: "hsla(120, 50%, 50%)",
                    width: "100px",
                    height: "200px",
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
                    height: "200px",
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
                        height: "200px",
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
                        height: "200px",
                        position: "absolute",
                        top: "0px",
                        left: "0px",
                    }}
                >
                    <motion.div
                        layout
                        style={{
                            backgroundColor: "hsla(300, 50%, 50%)",
                            width: expanded ? "500px" : "200px",
                            height: expanded ? "500px" : "200px",
                            position: "absolute",
                            top: expanded ? "100px" : "0px",
                            left: expanded ? "100px" : "0px",
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
        <MotionConfig transition={{ duration: 2 }}>
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    width: "1000px",
                    height: "4000px",
                    overflow: "hidden",
                    justifyContent: "flex-start",
                    alignItems: "flex-start",
                }}
                onClick={() => {
                    setExpanded(!expanded)
                }}
            >
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
                <Group expanded={expanded}>
                    <Group />
                </Group>
            </div>
        </MotionConfig>
    )
}
