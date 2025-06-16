import { animate, motion } from "framer-motion"
import { useEffect, useState } from "react"

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
            onComplete: () =>
                setResult(
                    output[1] !== 100 && output.length !== 2
                        ? "Success"
                        : "Fail"
                ),
        })
        return controls.stop
    }, [count])

    return (
        <section
            style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                padding: "100px",
            }}
        >
            <button id="action" onClick={() => setCount((c) => c + 1)}>
                Animate
            </button>
            <input id="result" readOnly value={result} />
            <motion.div
                layout
                style={{
                    width: "100px",
                    height: "100px",
                    backgroundColor: "red",
                }}
            />
        </section>
    )
}
