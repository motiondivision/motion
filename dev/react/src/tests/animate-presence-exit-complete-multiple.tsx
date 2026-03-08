import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"

/**
 * Reproduction from issue #3233:
 * Multiple AnimatePresence instances with a shared layoutId child that
 * cycles through them. onExitComplete should fire exactly once per exit.
 */
const maxNum = 4

const boxStyle: React.CSSProperties = {
    width: 100,
    height: 100,
    background: "aqua",
    marginBottom: 20,
    position: "relative",
}

const measurerStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    border: "1px solid",
    zIndex: 1,
}

function Boxes({
    startIndex,
    onDone,
}: {
    startIndex: number
    onDone: () => void
}) {
    const [prevStartIndex, setPrevStartIndex] = useState(-1)
    const [currentIndex, setCurrentIndex] = useState(startIndex)

    if (prevStartIndex !== startIndex) {
        setPrevStartIndex(startIndex)
        setCurrentIndex(startIndex)
    }

    useEffect(() => {
        if (startIndex < maxNum - 1) {
            setCurrentIndex((index) => index + 1)
        }
    }, [])

    return (
        <div>
            {Array(maxNum)
                .fill(0)
                .map((_, index) => (
                    <div key={index} style={boxStyle}>
                        <AnimatePresence
                            onExitComplete={() =>
                                index === maxNum - 1 && onDone()
                            }
                        >
                            {currentIndex === index && (
                                <motion.div
                                    layout
                                    layoutId="measurer"
                                    style={measurerStyle}
                                    onLayoutAnimationComplete={() => {
                                        if (currentIndex < maxNum - 1) {
                                            setCurrentIndex(
                                                (idx) => idx + 1
                                            )
                                        }
                                    }}
                                />
                            )}
                        </AnimatePresence>
                    </div>
                ))}
        </div>
    )
}

export const App = () => {
    const [startIndex, setStartIndex] = useState(0)
    const [doneCount, setDoneCount] = useState(0)

    return (
        <>
            <Boxes
                startIndex={startIndex}
                onDone={() => setDoneCount((c) => c + 1)}
            />
            <span id="done-count">{doneCount}</span>
            <button id="start-1" onClick={() => setStartIndex(1)}>
                start 1
            </button>
        </>
    )
}
