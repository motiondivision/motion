import { motion, MotionValue, useScroll, useTransform } from "framer-motion"
import * as React from "react"
import { useEffect, useRef } from "react"

/**
 * useScroll's progress is always tracked in JS, while opacity bound to it is
 * accelerated with a ViewTimeline where possible. The two should agree.
 */
const offsets: [string, any][] = [
    ["default", undefined],
    [
        "Enter",
        [
            [0, 1],
            [1, 1],
        ],
    ],
    [
        "Exit",
        [
            [0, 0],
            [1, 0],
        ],
    ],
    [
        "Any",
        [
            [1, 0],
            [0, 1],
        ],
    ],
    [
        "All",
        [
            [0, 0],
            [1, 1],
        ],
    ],
    ["start end, end start", ["start end", "end start"]],
    ["start start, end end", ["start start", "end end"]],
    ["end end, start start", ["end end", "start start"]],
    ["center start, end end", ["center start", "end end"]],
    ["start center, end start", ["start center", "end start"]],
]

const sizes = { small: 100, large: 800, equal: 500 }

interface Cell {
    name: string
    size: string
    element: HTMLElement
    progress: MotionValue<number>
    // A useTransform input range applied to progress
    range?: [number, number]
}

const clamp = (v: number) => Math.min(1, Math.max(0, v))

const cells: Cell[] = []

;(window as any).readCells = () =>
    cells.map(
        ({ name, size, element, progress, range: [from, to] = [0, 1] }) => ({
            name,
            size,
            accelerated: !!progress.accelerate,
            js: clamp((progress.get() - from) / (to - from)),
            native: parseFloat(getComputedStyle(element).opacity),
            timeline: element.getAnimations()[0]?.timeline?.constructor.name,
        })
    )

const useCell = (
    ref: React.RefObject<HTMLElement | null>,
    cell: Omit<Cell, "element">
) =>
    useEffect(() => {
        const registered = { ...cell, element: ref.current! }
        cells.push(registered)
        return () => {
            cells.splice(cells.indexOf(registered), 1)
        }
    }, [])

const Probe = ({
    name,
    size,
    offset,
    target,
}: {
    name: string
    size: string
    offset: any
    target: React.RefObject<HTMLDivElement | null>
}) => {
    const ref = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({ target, offset })

    useCell(ref, { name, size, progress: scrollYProgress })

    return (
        <motion.div ref={ref} style={{ ...probe, opacity: scrollYProgress }} />
    )
}

const Target = ({ size }: { size: keyof typeof sizes }) => {
    const ref = useRef<HTMLDivElement>(null)
    return (
        <>
            <div style={spacer} />
            <div
                ref={ref}
                id={size}
                style={{ height: sizes[size], background: "#0077ff" }}
            />
            <div style={probes}>
                {offsets.map(([name, offset]) => (
                    <Probe
                        key={name}
                        name={name}
                        size={size}
                        offset={offset}
                        target={ref}
                    />
                ))}
            </div>
        </>
    )
}

/**
 * #3658 reproductions: magicui's text reveal, a tall target with a sticky
 * child whose words are motion components bound to useScroll progress.
 */
const Word = ({
    text,
    progress,
    range,
    size,
}: {
    text: string
    progress: MotionValue<number>
    range: [number, number]
    size: string
}) => {
    const ref = useRef<HTMLSpanElement>(null)
    const opacity = useTransform(progress, range, [0, 1])
    useCell(ref, { name: `word "${text}"`, size, progress, range })
    return (
        <motion.span ref={ref} style={{ opacity, margin: 4 }}>
            {text}
        </motion.span>
    )
}

const TextReveal = ({ size, offset }: { size: string; offset?: any }) => {
    const ref = useRef<HTMLDivElement>(null)
    const probeRef = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({ target: ref, offset })
    useCell(probeRef, { name: "text reveal", size, progress: scrollYProgress })
    const words = "Magic UI will change the way you design.".split(" ")

    return (
        <div ref={ref} id={size} style={{ position: "relative", height: 1000 }}>
            <div style={{ position: "sticky", top: 0, height: "50%" }}>
                <motion.div
                    ref={probeRef}
                    style={{ ...probe, opacity: scrollYProgress }}
                />
                {words.map((text, i) => (
                    <Word
                        key={i}
                        text={text}
                        size={size}
                        progress={scrollYProgress}
                        range={[i / words.length, (i + 1) / words.length]}
                    />
                ))}
            </div>
        </div>
    )
}

// The CodeSandbox: inside a parent whose scale and clip-path track its scroll
const TransformedParent = () => {
    const ref = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "start 0.3"],
    })
    const clipPath = useTransform(
        scrollYProgress,
        [0, 1],
        ["inset(8% 12% round 24px)", "inset(0% 0% round 0px)"]
    )
    const scale = useTransform(scrollYProgress, [0, 1], [0.95, 1])

    return (
        <div ref={ref}>
            <motion.div style={{ clipPath, scale }}>
                <TextReveal
                    size="transformed-parent"
                    offset={["start start", "end end"]}
                />
            </motion.div>
        </div>
    )
}

// lezan/use-scroll-bug: inside a fixed overlay, with the default offset
const FixedOverlay = () => (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
        <div style={{ height: 500 }}>
            <TextReveal size="fixed-overlay" />
        </div>
    </div>
)

export const App = () => (
    <div>
        <Target size="small" />
        <Target size="large" />
        <Target size="equal" />
        <div style={spacer} />
        <TransformedParent />
        <div style={spacer} />
        <FixedOverlay />
    </div>
)

const spacer = { height: 600 }
const probes: React.CSSProperties = { position: "fixed", top: 0, left: 0 }
const probe = { width: 1, height: 1 }
