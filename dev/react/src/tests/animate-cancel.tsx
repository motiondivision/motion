import { useAnimate } from "framer-motion"
import { StrictMode, useEffect } from "react"

function Test() {
    const [scope, animate] = useAnimate()

    useEffect(() => {
        const controls = animate(scope.current, { opacity: 0 }, { duration: 2 })
        return () => {
            try {
                controls.cancel()
            } catch (e) {
                if (scope.current) {
                    scope.current.innerHTML = "error"
                }
                console.error(e)
            }
        }
    }, [])

    return (
        <div
            ref={scope}
            className="box"
            style={{ width: "2rem", height: "2rem", background: "red" }}
        />
    )
}

export function App() {
    return (
        <StrictMode>
            <Test />
        </StrictMode>
    )
}
