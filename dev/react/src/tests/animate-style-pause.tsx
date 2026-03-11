import { animateMini } from "framer-motion/dom"
import { useRef, useEffect } from "react"

export const App = () => {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!ref.current) return

        const animation = animateMini(
            ref.current,
            { width: 200 },
            { duration: 1 } // Longer duration for CI timing reliability
        )

        const timeoutId = setTimeout(() => {
            animation.pause()
        }, 100)

        return () => {
            clearTimeout(timeoutId)
            animation.cancel()
        }
    }, [])

    return <div id="box" ref={ref} style={style} />
}

const style = {
    width: 100,
    height: 100,
    backgroundColor: "#fff",
}
