import { Box, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"

/**
 * This is an example of transferring drag status by tagging a component with layoutId
 */

interface TargetProps {
    onProjectionUpdate: (box: Box) => void
}

function Target({ onProjectionUpdate }: TargetProps) {
    return (
        <motion.div
            style={{
                background: "rgba(255, 255, 255, 0.5)",
                width: "100px",
                height: "100px",
                borderRadius: "20px",
            }}
        >
            <motion.div
                drag
                dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
                dragElastic={1}
                onLayoutMeasure={onProjectionUpdate}
                layoutId="a"
                style={{
                    background: "white",
                    width: "100px",
                    height: "100px",
                    borderRadius: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <motion.div
                    layoutId="dot"
                    style={{
                        background: "rgb(255, 0, 136)",
                        width: "20px",
                        height: "20px",
                        borderRadius: "10px",
                    }}
                />
            </motion.div>
        </motion.div>
    )
}

function DragDrop() {
    const viewportWidth = useRef(0)
    const [is, setIs] = useState(true)

    useEffect(() => {
        viewportWidth.current = window.innerWidth
    }, [])

    return (
        <>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "50%",
                    height: "100%",
                }}
            >
                {is && (
                    <Target
                        onProjectionUpdate={(box: Box) => {
                            if (box.x.min > viewportWidth.current / 2 + 100) {
                                setIs(false)
                            }
                        }}
                    />
                )}
            </div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "50%",
                    height: "100%",
                }}
            >
                {!is && (
                    <Target
                        onProjectionUpdate={(box: Box) => {
                            if (box.x.min < viewportWidth.current / 2 - 100) {
                                setIs(true)
                            }
                        }}
                    />
                )}
            </div>
        </>
    )
}

export const App = () => {
    return (
        <div
            style={{
                width: "100vw",
                height: "100vh",
                position: "absolute",
                display: "flex",
                alignItems: "stretch",
                justifyContent: "stretch",
            }}
        >
            <DragDrop />
        </div>
    )
}
