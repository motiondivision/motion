import { timeline, useScopeMotion } from "framer-motion"
import { useRef } from "react"

export const App = () => {
    const ref = useRef<HTMLDivElement>(null)
    const scope = useScopeMotion(ref, () => {})

    return (
        <div className="App" ref={ref}>
            <div
                className="four"
                style={{
                    width: 50,
                    height: 50,
                    opacity: 0.5,
                    backgroundColor: "hotpink",
                    transform: "scale(0.1)",
                }}
            ></div>
            <p>Take in original transform</p>
            <button
                onClick={() => {
                    scope.current?.run(() => {
                        timeline([
                            [
                                ".four",
                                { x: 90, scale: 2, opacity: 1 },
                                { duration: 2 },
                            ],
                        ])
                    })
                }}
            >
                play
            </button>
        </div>
    )
}
