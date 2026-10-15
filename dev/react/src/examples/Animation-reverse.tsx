import { timeline, useAnimate } from "framer-motion"

export const App = () => {
    const [scope] = useAnimate()

    return (
        <div className="App" ref={scope}>
            <div
                className="four"
                style={{ width: 50, height: 50, backgroundColor: "blue" }}
            ></div>
            <p>reverse</p>
            <button
                onClick={() => {
                    const animation = timeline(
                        ["my label", [".four", { x: 90 }, { duration: 2 }]],
                        { scope }
                    )

                    animation.time = animation.duration
                    animation.speed = -1
                }}
            >
                play
            </button>
        </div>
    )
}
