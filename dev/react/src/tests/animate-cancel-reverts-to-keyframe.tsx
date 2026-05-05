import { useEffect, useRef, useState } from "react"
import { animate } from "framer-motion"

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const App = () => {
    const ref = useRef<HTMLDivElement>(null)
    const [result, setResult] = useState("running")

    useEffect(() => {
        const el = ref.current
        if (!el) return
        ;(async () => {
            await animate(el, { opacity: 1 }, { duration: 0.1 }).finished
            const before = el.style.opacity

            await animate(el, { opacity: 0 }, { duration: 0.1 }).finished
            const persisted = el.style.opacity

            // Cancel mid-flight must revert to this animation's start value
            // (0, persisted by the previous animation), not strip the inline
            // style entirely.
            const c = animate(el, { opacity: 1 }, { duration: 0.5 })
            await wait(50)
            c.cancel()
            const after = el.style.opacity

            setResult(
                before === "1" && persisted === "0" && after === "0"
                    ? "success"
                    : `fail:before=${before},persisted=${persisted},after=${after}`
            )
        })()
    }, [])

    return (
        <div ref={ref} className="box" id="box" style={{ opacity: 0 }}>
            {result}
        </div>
    )
}
