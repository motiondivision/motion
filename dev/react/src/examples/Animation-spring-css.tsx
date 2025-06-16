import { spring } from "framer-motion/dom"
import { motion } from "framer-motion"
import { useEffect, useState } from "react"

const height = 100
const width = 500
const margin = 10

export function SpringVisualiser({ transition }: any) {
    const { duration, bounce } = {
        duration: transition.duration * 1000,
        bounce: transition.bounce,
    }
    const springResolver = spring({
        bounce,
        visualDuration: duration,
        keyframes: [0, 1],
    })

    let curveLine = `M${margin} ${margin + height}`
    let perceptualMarker = ""

    const step = 10
    for (let i = 0; i <= width; i++) {
        const t = i * step

        if (t > duration && perceptualMarker === "") {
            perceptualMarker = `M${margin + i} ${margin} L${margin + i} ${
                margin + height
            }`
        }

        curveLine += `L${margin + i} ${
            margin + (height - springResolver.next(t).value * (height / 2))
        }`
    }

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={width + margin * 2}
            height={height + margin * 2}
        >
            <path
                d={curveLine}
                fill="transparent"
                strokeWidth="2"
                stroke="#AAAAAA"
                strokeLinecap="round"
                strokeLinejoin="round"
            ></path>
            <path
                d={perceptualMarker}
                fill="transparent"
                strokeWidth="2"
                stroke="#AAAAAA"
                strokeLinecap="round"
                strokeLinejoin="round"
            ></path>
        </svg>
    )
}

/**
 * An example of the tween transition type
 */

const style = {
    width: 100,
    height: 100,
    background: "white",
}
export const App = () => {
    const [state, setState] = useState(false)

    const [duration, setDuration] = useState(1)
    const [bounce, setBounce] = useState(0.2)

    useEffect(() => {
        setTimeout(() => {
            setState(true)
        }, 300)
    }, [state])

    return (
        <>
            <div
                style={{
                    ...style,
                    transform: state ? "translateX(200px)" : "none",
                    transition: "transform " + spring(duration, bounce),
                }}
            />
            <motion.div
                animate={{
                    transform: state ? "translateX(200px)" : "translateX(0)",
                }}
                transition={{
                    visualDuration: duration,
                    bounce,
                    type: "spring",
                }}
                style={style}
            />
            <SpringVisualiser
                transition={{
                    duration,
                    type: "spring",
                    bounce,
                    durationBasedSpring: true,
                }}
            />
            <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={bounce}
                onChange={(e) => setBounce(Number(e.target.value))}
            />
            <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
            />
        </>
    )
}
