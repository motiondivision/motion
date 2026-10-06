import { cancelFrame, frame, motion, visualElementStore } from "framer-motion"
import { useEffect } from "react"

/**
 * For tests/react/pooled-animations.spec.ts. Each box animates x on the
 * compositor.
 */
const transition = { duration: 3, ease: "linear" } as const

const box = {
    width: 100,
    height: 50,
    background: "#0077ff",
}

let isDown = false

/**
 * Record an element's position after Motion renders, every frame, with
 * whether the pointer is down. t is the document timeline's time, which
 * WAAPI animations are sampled at, and ts is Motion's frame timestamp,
 * which JS animations are sampled at.
 */
const recordFrames = (id: string, ms: number) =>
    new Promise((resolve) => {
        const element = document.getElementById(id)!
        const frames: object[] = []
        const start = performance.now()
        const record = ({ timestamp }: { timestamp: number }) => {
            frames.push({
                t: document.timeline.currentTime,
                ts: timestamp,
                left: element.getBoundingClientRect().left,
                isDown,
                count: element.getAnimations().length,
            })
            if (performance.now() - start >= ms) {
                cancelFrame(record)
                resolve(frames)
            }
        }
        frame.postRender(record, true)
    })

export const App = () => {
    useEffect(() => {
        ;(window as any).recordFrames = recordFrames

        /**
         * x.get() and where the element is, in the same frame.
         */
        ;(window as any).readBack = () =>
            new Promise((resolve) =>
                frame.postRender(() => {
                    const element = document.getElementById("readback")!
                    resolve({
                        value: visualElementStore
                            .get(element)!
                            .getValue("x")!
                            .get(),
                        left: element.getBoundingClientRect().left,
                        count: element.getAnimations().length,
                    })
                })
            )
    }, [])

    return (
        <>
            <motion.div
                id="readback"
                style={box}
                animate={{ x: 600 }}
                transition={transition}
            />
            <motion.div
                id="drag"
                drag="x"
                dragMomentum={false}
                onPointerDown={() => (isDown = true)}
                style={box}
                animate={{ x: 600 }}
                transition={transition}
            />
        </>
    )
}
