import { AsyncMotionValueAnimation, motionValue } from "motion-dom"
import { useEffect, useRef } from "react"

interface ExtendedMotionValue {
    owner: { current: HTMLDivElement | undefined; getProps: () => unknown }
}

interface ExtendedAnimation extends AsyncMotionValueAnimation<number> {
    _resolved: boolean
}

export const App = () => {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!ref.current) return
        const opacity = motionValue(0)
        const extendedOpacity = opacity as unknown as ExtendedMotionValue
        extendedOpacity.owner = { current: ref.current, getProps: () => ({}) }

        const animation = new AsyncMotionValueAnimation({
            keyframes: [0, 1],
            motionValue: opacity,
            name: "opacity",
        })

        animation.stop()

        // If this animation resolved, that is incorrect
        const extendedAnimation = animation as unknown as ExtendedAnimation
        if (extendedAnimation._resolved) {
            ref.current.textContent = "Error"
        }

        new AsyncMotionValueAnimation({
            keyframes: [0.4, 0.5],
            motionValue: opacity,
            name: "opacity",
        })

        // Animation shouldn't fail if element is removed before keyframes resolve
        extendedOpacity.owner.current = undefined
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
        </section>
    )
}
