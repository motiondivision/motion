import { timeline, useScopeMotion } from "framer-motion"
import { useRef } from "react"

export const App = () => {
    const ref = useRef<HTMLDivElement>(null)
    const scope = useScopeMotion(ref, () => {})

    return (
        <div className="App" ref={ref}>
            <div
                className="four"
                style={{ width: 50, height: 50, backgroundColor: "blue" }}
            ></div>
            <p>reverse</p>
            <button
                onClick={() => {
                    scope.current?.run(() => {
                        const animation = timeline([
                            "my label",
                            [".four", { x: 90 }, { duration: 2 }],
                        ])

                        animation.time = animation.duration
                        animation.speed = -1
                    })
                }}
            >
                play
            </button>
        </div>
    )
}
