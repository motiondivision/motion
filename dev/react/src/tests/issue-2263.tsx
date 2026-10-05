import { motion } from "framer-motion"
import { createRef, useEffect, useMemo, useState } from "react"

/**
 * Issue #2263: when the ref object passed to a motion component changes
 * between renders, the new ref should receive the DOM element.
 */
export const App = () => {
    const [count, setCount] = useState(0)
    const ref = useMemo(() => createRef<HTMLDivElement>(), [count])
    const [result, setResult] = useState("pending")

    useEffect(() => {
        setResult(
            ref.current && ref.current.id === "box" ? "bound" : "unbound"
        )
    }, [ref])

    return (
        <>
            <button id="refresh" onClick={() => setCount((c) => c + 1)}>
                Refresh
            </button>
            <motion.div id="box" ref={ref} animate={{ opacity: 1 }} />
            <div id="result" data-count={count}>
                {result}
            </div>
        </>
    )
}
