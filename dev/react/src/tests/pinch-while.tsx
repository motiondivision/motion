import {
    domMax,
    LazyMotion,
    m,
    pinchFeatures,
    useMotionValue,
} from "framer-motion"
import { useState } from "react"

/**
 * The pinch prop in React: whilePinch on the box and, by variant label, on
 * its child, a tap counter, and drag with its release velocity. The
 * 100x100 box starts at (100, 100). Add ?drag to make it draggable.
 */
export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const isDraggable = params.has("drag")
    const opacity = useMotionValue(1)
    const [taps, setTaps] = useState(0)
    const [velocity, setVelocity] = useState<number | null>(null)

    return (
        <LazyMotion features={{ ...domMax, ...pinchFeatures }}>
            <m.div
                id="box"
                drag={isDraggable}
                dragMomentum={false}
                pinch
                whilePinch="pinching"
                whileTap={{ backgroundColor: "rgb(0, 0, 255)" }}
                onTap={() => setTaps((t) => t + 1)}
                onDragEnd={(_, info) => setVelocity(info.velocity.x)}
                transition={{ duration: 0 }}
                variants={{ pinching: { opacity: 0.5 } }}
                style={{
                    position: "absolute",
                    left: 100,
                    top: 100,
                    width: 100,
                    height: 100,
                    opacity,
                    backgroundColor: "rgb(255, 0, 0)",
                }}
            >
                <m.div
                    id="child"
                    transition={{ duration: 0 }}
                    variants={{ pinching: { opacity: 0.25 } }}
                    style={{ width: 20, height: 20, background: "white" }}
                />
            </m.div>
            <output id="taps">{taps}</output>
            <output id="velocity">{velocity ?? ""}</output>
        </LazyMotion>
    )
}
