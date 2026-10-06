import { useAnimate } from "framer-motion"
import { useEffect, useState } from "react"

/**
 * Pause, seek and playback rate drive the native animation directly.
 */
export const App = () => {
    const [scope, animate] = useAnimate()
    const [result, setResult] = useState("")

    useEffect(() => {
        const controls = animate(
            scope.current,
            { x: 200 },
            { type: "tween", ease: "linear", duration: 10 }
        )

        const timer = setTimeout(() => {
            const box = scope.current as HTMLElement
            const [animation] = box.getAnimations()
            const output: Record<string, any> = {
                animations: box.getAnimations().length,
            }

            controls.pause()
            output.paused = animation.playState

            controls.time = 5
            output.currentTime = Math.round(Number(animation.currentTime))

            controls.speed = 2
            output.playbackRate = animation.playbackRate

            controls.play()
            output.playing = animation.playState
            output.sameAnimation = box.getAnimations()[0] === animation

            setResult(JSON.stringify(output))
        }, 500)

        return () => clearTimeout(timer)
    }, [])

    return (
        <>
            <div
                ref={scope}
                id="box"
                style={{ width: 100, height: 100, background: "red" }}
            />
            <div id="result">{result}</div>
        </>
    )
}
