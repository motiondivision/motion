import { animate } from "framer-motion"
import { useRef, useEffect, useState } from "react"

export const App = () => {
    const ref = useRef<HTMLDivElement>(null)
    const [opacity, setOpacity] = useState<string | null>(null)

    useEffect(() => {
        if (!ref.current) return

        const animation = animate(
            ref.current,
            { opacity: 0.5 },
            { duration: 10, autoplay: false }
        )

        // Check opacity after a short delay to confirm it hasn't started
        const timer = setTimeout(() => {
            if (ref.current) {
                setOpacity(getComputedStyle(ref.current).opacity)
            }
        }, 100)

        return () => {
            animation.stop()
            clearTimeout(timer)
        }
    }, [])

    return (
        <>
            <div
                id="box"
                ref={ref}
                style={{ width: 100, height: 100, backgroundColor: "#fff", opacity: 1 }}
            />
            <div id="opacity">{opacity}</div>
        </>
    )
}
