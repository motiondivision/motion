import { animate, pipe } from "framer-motion"
import { useEffect } from "react"

function testAnimation(selector: string, values: any) {
    const element = document.querySelector(selector)
    if (!element) return () => {}

    const animation = animate(element, values, { duration: 1, ease: "linear" })
    animation.time = 0.5
    animation.pause()

    return () => animation.cancel()
}
export const App = () => {
    useEffect(() => {
        return pipe(
            testAnimation(".translate", { x: 200, y: 200 }),
            testAnimation(".rotate", { rotate: 100 }),
            testAnimation(".scale", { scale: 4 })
        ) as () => void
    }, [])

    return (
        <div>
            <div
                style={{ ...box, transform: "translate(100px, 100px)" }}
                className="translate"
            />
            <div
                style={{ ...box, transform: "rotate(90deg)" }}
                className="rotate"
            />
            <div style={{ ...box, transform: "scale(2)" }} className="scale" />
        </div>
    )
}

const box = {
    width: 100,
    height: 100,
    background: "red",
}
