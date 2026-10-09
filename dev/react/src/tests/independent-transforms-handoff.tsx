import { cancelFrame, frame, motion } from "framer-motion"
import { useEffect, useState } from "react"

/**
 * Layout hand-offs for tests/react/independent-transforms-handoff.spec.ts.
 * Each box animates x on the compositor until a render makes projection
 * measure it, which moves its transforms to the main thread.
 */
const transition = { x: { duration: 3, ease: "linear" } } as const

const box = {
    width: 100,
    height: 50,
    background: "#0077ff",
}

/**
 * Record an element's position after Motion renders, every frame. t is the
 * document timeline's time, which WAAPI animations are sampled at, and ts
 * is Motion's frame timestamp, which JS animations are sampled at.
 */
;(window as any).recordFrames = (id: string, ms: number) =>
    new Promise((resolve) => {
        const element = document.getElementById(id)!
        const frames: object[] = []
        const start = performance.now()
        const record = ({ timestamp }: { timestamp: number }) => {
            const { left, top } = element.getBoundingClientRect()
            frames.push({
                t: document.timeline.currentTime,
                ts: timestamp,
                left,
                top,
                count: element
                    .getAnimations()
                    .filter((animation) =>
                        (animation.effect as KeyframeEffect)
                            .getKeyframes()
                            .some((keyframe) => "transform" in keyframe)
                    ).length,
            })
            if (performance.now() - start >= ms) {
                cancelFrame(record)
                resolve(frames)
            }
        }
        frame.postRender(record, true)
    })

export const App = () => {
    const [renders, setRenders] = useState(0)
    const [isTall, setIsTall] = useState(false)

    useEffect(() => {
        ;(window as any).rerender = () => setRenders((count) => count + 1)
        ;(window as any).grow = () => setIsTall(true)
    }, [])

    return (
        <>
            <motion.div
                id="rerender"
                layout
                data-renders={renders}
                style={box}
                animate={{ x: 600 }}
                transition={transition}
            />
            <div style={{ height: isTall ? 100 : 50 }} />
            <motion.div
                id="shift"
                layout
                style={box}
                animate={{ x: 600 }}
                transition={{ ...transition, layout: { duration: 0.3 } }}
            />
        </>
    )
}
