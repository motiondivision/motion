import { animate, motion } from "framer-motion"
import { useEffect, useState } from "react"

const containerStyles = {
    position: "relative" as const,
    display: "flex",
    flexDirection: "column" as const,
    padding: "100px",
}

const boxStyles = {
    width: "100px",
    height: "100px",
    backgroundColor: "red",
}

export const App = () => {
    const [count, setCount] = useState(0)
    const [result, setResult] = useState("")

    useEffect(() => {
        if (count % 2 === 0) return

        const output: number[] = []
        const controls = animate(0, 100, {
            duration: 0.5,
            ease: "linear",
            onUpdate: (v: number) => output.push(v),
            onComplete: () => {
                setResult(
                    output[0] === 100 && output.length !== 2
                        ? "Success"
                        : "Fail"
                )
            },
        })
        controls.time = controls.duration
        controls.speed = -1

        return controls.stop
    }, [count])

    return (
        <div style={containerStyles}>
            <button id="action" onClick={() => setCount((c) => c + 1)}>
                Animate
            </button>
            <input id="result" readOnly value={result} />
            <motion.div className="box" layout style={boxStyles} />
        </div>
    )
}
