import { animate } from "framer-motion"
import { animateMotionValue, motionValue } from "motion-dom"
import { useEffect, useRef } from "react"

/**
 * An animation stopped before its keyframes resolve must start nothing,
 * and an element removed before its keyframes resolve must not throw.
 */
export const App = () => {
    const ref = useRef<HTMLDivElement>(null)
    const removed = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const box = ref.current
        const detached = removed.current
        if (!box || !detached) return

        const fail = () => (box.textContent = "Error")
        window.addEventListener("error", fail)

        // Stopped in the call that made it.
        const animation = animate(box, { opacity: [0, 1] }, { duration: 1 })
        animation.stop()

        // The same for one motion value on a clock of its own.
        const opacity = motionValue<number>(1)
        opacity.on("change", fail)
        const owner: any = { current: box, getProps: () => ({}) }
        animateMotionValue(
            "opacity",
            opacity,
            [0, 1],
            { duration: 1 },
            owner
        )(fail)?.stop()

        // Its element is gone before its keyframes resolve.
        const gone = { ...owner, current: undefined }
        animateMotionValue(
            "opacity",
            motionValue<number>(0),
            [0.4, 0.5],
            {},
            gone
        )(() => {})

        // Removed before its keyframes resolve.
        animate(detached, { opacity: [0.4, 0.5] }, { duration: 1 })
        detached.remove()

        return () => window.removeEventListener("error", fail)
    }, [])

    return (
        <section
            style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                padding: "100px",
            }}
        >
            <div
                ref={ref}
                id="box"
                style={{
                    width: "100px",
                    height: "100px",
                    position: "relative",
                    top: "100px",
                    left: "100px",
                    backgroundColor: "red",
                    opacity: 1,
                }}
            >
                Content
            </div>
            <div ref={removed} id="removed" />
        </section>
    )
}
