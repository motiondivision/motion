import {
    easeIn,
    easeOut,
    motion,
    MotionValue,
    useScroll,
    useTransform,
} from "framer-motion"
import * as React from "react"
import { useEffect, useRef } from "react"

/**
 * Opacities whose useTransform input ranges cover only part of the page's
 * scroll progress, which is accelerated with a ScrollTimeline where it's
 * supported. A text reveal gives each word [i / n, (i + 1) / n].
 */
interface Cell {
    name: string
    element: HTMLElement
    opacity: MotionValue<number>
}

const cells: Cell[] = []

;(window as any).readCells = () =>
    cells.map(({ name, element, opacity }) => ({
        name,
        js: opacity.get(),
        native: parseFloat(getComputedStyle(element).opacity),
        timeline: element.getAnimations()[0]?.timeline?.constructor.name,
    }))

const Probe = ({
    name,
    progress,
    inputRange,
    outputRange,
    ease,
}: {
    name: string
    progress: MotionValue<number>
    inputRange: number[]
    outputRange: number[]
    ease?: Array<(v: number) => number>
}) => {
    const ref = useRef<HTMLSpanElement>(null)
    const opacity = useTransform(progress, inputRange, outputRange, { ease })

    useEffect(() => {
        const cell = { name, element: ref.current!, opacity }
        cells.push(cell)
        return () => {
            cells.splice(cells.indexOf(cell), 1)
        }
    }, [])

    return (
        <motion.span ref={ref} style={{ opacity, margin: 4 }}>
            {name}
        </motion.span>
    )
}

const words = "Magic UI will change the way you design.".split(" ")

export const App = () => {
    const { scrollYProgress } = useScroll()

    return (
        <div style={{ height: 3000 }}>
            <div style={{ position: "fixed", top: 0, left: 0 }}>
                {words.map((word, i) => (
                    <Probe
                        key={i}
                        name={`word ${i} "${word}"`}
                        progress={scrollYProgress}
                        inputRange={[i / words.length, (i + 1) / words.length]}
                        outputRange={[0, 1]}
                    />
                ))}
                <Probe
                    name="eased segments"
                    progress={scrollYProgress}
                    inputRange={[0.2, 0.4, 0.6]}
                    outputRange={[0.2, 1, 0.5]}
                    ease={[easeIn, easeOut]}
                />
            </div>
        </div>
    )
}
