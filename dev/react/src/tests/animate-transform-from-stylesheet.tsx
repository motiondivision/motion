import { animate } from "framer-motion"
import { useEffect, useRef } from "react"

export const App = () => {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const animation = animate(
            ref.current!,
            { x: 200 },
            { duration: 10, ease: "linear" }
        )
        return () => animation.stop()
    }, [])

    return (
        <>
            <style>{`#box { transform: translateX(100px); }`}</style>
            <div id="box" ref={ref} style={{ width: 10, height: 10 }} />
        </>
    )
}
