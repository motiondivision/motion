import { animate } from "framer-motion/dom/mini"
import { useEffect, useRef } from "react"

export const App = () => {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!ref.current) return

        try {
            CSS.registerProperty({
                name: "--x",
                syntax: "<length>",
                inherits: false,
                initialValue: "0px",
            })
        } catch (e) {
            // console.error(e)
        }

        const animation = animate(
            ref.current,
            { "--x": ["0px", "500px"] },
            { duration: 0.1 }
        )

        return () => {
            animation.cancel()
        }
    }, [])

    return (
        <div id="box" ref={ref} style={style}>
            content
        </div>
    )
}

const style = {
    width: 100,
    height: 100,
    backgroundColor: "#fff",
    left: "var(--x)",
    position: "relative",
} as const
