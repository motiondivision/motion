import { useAnimate } from "framer-motion"

export const App = () => {
    const [scope, animate] = useAnimate()

    return (
        <div className="App" ref={scope}>
            <div
                className="four"
                style={{ width: 50, height: 50, backgroundColor: "blue" }}
            ></div>
            <p>reverse</p>
            <button
                onClick={() => {
                    const animation = animate([
                        "my label",
                        [".four", { x: 90 }, { duration: 2 }],
                    ])
                    animation.time = animation.duration
                    animation.speed = -1
                }}
            >
                play
            </button>
        </div>
    )
}
