import { useAnimate } from "framer-motion"
import { useEffect, useState } from "react"

/**
 * Reproduction for #3158: spring animations with animation sequences
 * should not throw "Only two keyframes currently supported with spring
 * and inertia animations".
 */
export const App = () => {
    const [scope, animate] = useAnimate()
    const [result, setResult] = useState("")

    useEffect(() => {
        animate(
            [
                ["#box-a", { x: [0, 20], y: [0, 20] }],
                ["#box-b", { scale: [1, 2] }],
            ],
            { defaultTransition: { type: "spring" } }
        )
            .then(() => setResult("Success"))
            .catch(() => setResult("Error"))
    }, [])

    return (
        <div ref={scope} style={{ padding: 100 }}>
            <div
                id="box-a"
                style={{
                    width: 100,
                    height: 100,
                    backgroundColor: "red",
                }}
            />
            <div
                id="box-b"
                style={{
                    width: 100,
                    height: 100,
                    backgroundColor: "blue",
                }}
            />
            <input id="result" readOnly value={result} />
        </div>
    )
}
