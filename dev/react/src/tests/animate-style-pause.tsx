import { animateMini } from "framer-motion/dom"
import { useRef, useEffect } from "react"

export const App = () => {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!ref.current) return

        const animation = animateMini(
            ref.current,
            { width: 200 },
            { duration: 2 }
        )

        setTimeout(() => {
            animation.pause()
        }, 200)

        return () => animation.cancel()
    }, [])

    return <div id="box" ref={ref} style={style} />
}

const style = {
    width: 100,
    height: 100,
    backgroundColor: "#fff",
}
