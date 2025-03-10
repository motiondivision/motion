import { useAnimate } from "framer-motion"

export const App = () => {
    const [scope, animate] = useAnimate()

    return (
        <div className="App" ref={scope}>
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
                    animate([
                        [
                            ".four",
                            { x: 90, scale: 2, opacity: 1 },
                            { duration: 2 },
                        ],
                    ])
                }}
            >
                play
            </button>
        </div>
    )
}
