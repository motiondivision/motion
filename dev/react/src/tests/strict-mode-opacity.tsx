import { useAnimate } from "framer-motion"
import { StrictMode, useEffect, useRef, useState } from "react"

function Test() {
    const [scope, animate] = useAnimate()
    const controlsRef = useRef<any>(null)
    const [shouldAnimate, setShouldAnimate] = useState(false)

    useEffect(() => {
        controlsRef.current = animate(
            scope.current,
            { opacity: 1 },
            { duration: 0.5, autoplay: false }
        )

        return () => controlsRef.current?.stop()
    }, [])

    useEffect(() => {
        if (!controlsRef.current || !shouldAnimate) return
        controlsRef.current.play()
    }, [shouldAnimate])

    return (
        <>
            <div
                id="box"
                ref={scope}
                style={{
                    width: 100,
                    height: 100,
                    background: "red",
                    opacity: 0,
                }}
            />
            <button id="trigger" onClick={() => setShouldAnimate(true)}>
                Animate
            </button>
        </>
    )
}

export function App() {
    return (
        <StrictMode>
            <Test />
        </StrictMode>
    )
}
