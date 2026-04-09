import { useEffect, useRef, useState } from "react"
import { animate } from "framer-motion"

export const App = () => {
    const ref = useRef<HTMLDivElement>(null)
    const [result, setResult] = useState("running")

    useEffect(() => {
        if (!ref.current) return

        const animation = animate(
            ref.current,
            { opacity: 1 },
            { duration: 0.1 }
        )

        // Wait for animation to finish, then cancel
        const timeout = setTimeout(() => {
            const before = ref.current!.style.opacity

            animation.cancel()

            const after = ref.current!.style.opacity

            if (before === "1" && after === "") {
                setResult("success")
            } else {
                setResult(`fail:before=${before},after=${after}`)
            }
        }, 500)

        return () => clearTimeout(timeout)
    }, [])

    return (
        <div ref={ref} className="box" id="box" style={{ opacity: 0 }}>
            {result}
        </div>
    )
}
