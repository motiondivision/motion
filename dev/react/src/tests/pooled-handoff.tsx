import {
    animate,
    cancelFrame,
    frame,
    motion,
    MotionValue,
    useAnimate,
    useAnimationControls,
    useMotionValue,
} from "framer-motion"
import { styleEffect } from "motion-dom"
import { useEffect, useRef, useState } from "react"

/**
 * Records the box's position every frame while a pooled, hardware-accelerated
 * transform animation is moved onto the main thread, then checks that no
 * frame jumped, stalled or ran backwards. Each scenario is selected with
 * `?test=pooled-handoff&scenario=<name>`.
 *
 * Linear tweens run at 100px/s so each frame's expected movement is known
 * from its duration. Segments declare the expected speed of an axis over a
 * window (0 for a hold), starting after the first 100ms so the frames spent
 * starting the animations are left out. Continuity checks bound the jump
 * across a moment where the speed legitimately changes.
 */

interface Sample {
    t: number
    x: number
    y: number
    refY?: number
}

interface Segment {
    axis: "x" | "y"
    from: number
    to: number
    speed: number
}

interface Continuity {
    axis: "x" | "y"
    at: number
    maxJump: number
}

interface Context {
    /** Scoped animate() for the plain box. */
    a: typeof animate
    box: HTMLElement
    /** The y motion value bound to the box. */
    y: MotionValue<number>
    reference: HTMLElement
    /** Animation controls of the motion component box. */
    controls: ReturnType<typeof useAnimationControls>
    first?: any
}

interface Scenario {
    /** Record for this long, in ms. */
    duration: number
    /** Render a motion component rather than a plain element (styleEffect). */
    component?: boolean
    /** Bind y to a motion value so it can be driven from the main thread. */
    externalY?: boolean
    /** Animate a reference box on the main thread with the same spring. */
    reference?: boolean
    start: (context: Context) => any
    steps: Array<{ at: number; run: (context: Context) => void }>
    segments: Segment[]
    continuity?: Continuity[]
}

const linear = (duration: number, extra: any = {}) => ({
    type: "tween" as const,
    ease: "linear" as const,
    duration,
    ...extra,
})

/**
 * Forces a value onto the main thread: mirror repeats aren't accelerated.
 */
const mainThread = { repeat: 0, repeatType: "mirror" as const }

/**
 * Drive a motion value from the main thread at 100px/s, as useSpring or
 * useTransform would.
 */
function drive(value: MotionValue<number>) {
    const start = performance.now()
    const tick = () => value.set((performance.now() - start) / 10)
    frame.update(tick, true)
    return () => cancelFrame(tick)
}

const scenarios: Record<string, Scenario> = {
    /**
     * x and y share translate. Interrupting x moves both to the main thread.
     */
    "interrupt-sibling": {
        duration: 2000,
        start: ({ a, box }) => a(box, { x: 400, y: 400 }, linear(4)),
        steps: [
            { at: 1000, run: ({ a, box }) => a(box, { x: 400 }, linear(4)) },
        ],
        segments: [
            { axis: "x", from: 100, to: 1000, speed: 100 },
            { axis: "y", from: 100, to: 2000, speed: 100 },
        ],
        continuity: [{ axis: "x", at: 1000, maxJump: 8 }],
    },
    /**
     * y starts later with its own timing on the property x is using.
     */
    "late-join": {
        duration: 2000,
        start: ({ a, box }) => a(box, { x: 400 }, linear(4)),
        steps: [
            { at: 1000, run: ({ a, box }) => a(box, { y: 400 }, linear(4)) },
        ],
        segments: [
            { axis: "x", from: 100, to: 2000, speed: 100 },
            { axis: "y", from: 100, to: 1000, speed: 0 },
            { axis: "y", from: 1050, to: 2000, speed: 100 },
        ],
    },
    /**
     * A sibling value driven from the main thread while x is accelerated.
     */
    "sibling-main-thread": {
        duration: 2000,
        externalY: true,
        start: ({ a, box }) => a(box, { x: 400 }, linear(4)),
        steps: [{ at: 1000, run: ({ y }) => drive(y) }],
        segments: [
            { axis: "x", from: 100, to: 2000, speed: 100 },
            { axis: "y", from: 100, to: 1000, speed: 0 },
            { axis: "y", from: 1050, to: 2000, speed: 100 },
        ],
    },
    /**
     * The same value is retargeted: sampled from the native animation and
     * restarted, here in the opposite direction.
     */
    restart: {
        duration: 2000,
        start: ({ a, box }) => a(box, { x: 400 }, linear(4)),
        steps: [{ at: 1000, run: ({ a, box }) => a(box, { x: 0 }, linear(4)) }],
        segments: [
            { axis: "x", from: 100, to: 1000, speed: 100 },
            { axis: "x", from: 1050, to: 2000, speed: -25 },
        ],
        continuity: [{ axis: "x", at: 1000, maxJump: 8 }],
    },
    /**
     * stop() holds the current value.
     */
    stop: {
        duration: 2000,
        start: ({ a, box }) => a(box, { x: 400, y: 400 }, linear(4)),
        steps: [{ at: 1000, run: ({ first }) => first.stop() }],
        segments: [
            { axis: "x", from: 100, to: 1000, speed: 100 },
            { axis: "y", from: 100, to: 1000, speed: 100 },
            { axis: "x", from: 1050, to: 2000, speed: 0 },
            { axis: "y", from: 1050, to: 2000, speed: 0 },
        ],
        continuity: [
            { axis: "x", at: 1000, maxJump: 8 },
            { axis: "y", at: 1000, maxJump: 8 },
        ],
    },
    /**
     * A doubled playback rate carries over to the main thread.
     */
    speed: {
        duration: 2000,
        start: ({ a, box }) => a(box, { x: 400, y: 400 }, linear(4)),
        steps: [
            { at: 500, run: ({ first }) => (first.speed = 2) },
            { at: 1000, run: ({ a, box }) => a(box, { x: 400 }, linear(4)) },
        ],
        segments: [
            { axis: "y", from: 100, to: 500, speed: 100 },
            { axis: "y", from: 550, to: 2000, speed: 200 },
            { axis: "x", from: 550, to: 1000, speed: 200 },
        ],
        continuity: [{ axis: "x", at: 1000, maxJump: 12 }],
    },
    /**
     * A paused animation stays paused, at the same value, on the main thread.
     */
    paused: {
        duration: 2000,
        start: ({ a, box }) => a(box, { x: 400, y: 400 }, linear(4)),
        steps: [
            { at: 500, run: ({ first }) => first.pause() },
            { at: 1000, run: ({ a, box }) => a(box, { x: 400 }, linear(4)) },
        ],
        segments: [
            { axis: "y", from: 100, to: 500, speed: 100 },
            { axis: "y", from: 550, to: 2000, speed: 0 },
            { axis: "x", from: 550, to: 1000, speed: 0 },
        ],
        continuity: [{ axis: "x", at: 1000, maxJump: 8 }],
    },
    /**
     * Moving to the main thread during the delay keeps the delay.
     */
    delay: {
        duration: 2000,
        start: ({ a, box }) =>
            a(box, { x: 400, y: 400 }, linear(4, { delay: 1 })),
        steps: [
            { at: 500, run: ({ a, box }) => a(box, { x: 400 }, linear(4)) },
        ],
        segments: [
            { axis: "y", from: 100, to: 1000, speed: 0 },
            { axis: "y", from: 1050, to: 2000, speed: 100 },
            { axis: "x", from: 550, to: 2000, speed: 100 },
        ],
    },
    /**
     * A transform with no individual property moves the element back to
     * the transform shorthand mid-animation. Perspective doesn't move the
     * box, so its position can still be measured.
     */
    "exit-mode": {
        duration: 2000,
        start: ({ a, box }) => a(box, { x: 400, y: 400 }, linear(4)),
        steps: [
            {
                at: 1000,
                run: ({ a, box }) =>
                    a(box, { transformPerspective: 500 }, { duration: 0 }),
            },
        ],
        segments: [
            { axis: "x", from: 100, to: 2000, speed: 100 },
            { axis: "y", from: 100, to: 2000, speed: 100 },
        ],
    },
    /**
     * Setting a sibling instantly while the property is accelerated.
     */
    "set-sibling": {
        duration: 2000,
        start: ({ a, box }) => a(box, { x: 400, y: 400 }, linear(4)),
        steps: [
            {
                at: 1000,
                run: ({ a, box }) => a(box, { y: 50 }, { duration: 0 }),
            },
        ],
        segments: [
            { axis: "x", from: 100, to: 2000, speed: 100 },
            { axis: "y", from: 100, to: 1000, speed: 100 },
            { axis: "y", from: 1050, to: 2000, speed: 0 },
        ],
    },
    /**
     * A spring moved to the main thread follows the same curve as a spring
     * that ran on the main thread throughout.
     */
    spring: {
        duration: 2500,
        reference: true,
        start: ({ a, box, reference }) => {
            const transition = {
                type: "spring" as const,
                stiffness: 100,
                damping: 20,
            }
            a(reference, { y: 400 }, { ...transition, ...mainThread })
            return a(box, { x: 400, y: 400 }, transition)
        },
        steps: [
            { at: 1000, run: ({ a, box }) => a(box, { x: 400 }, linear(4)) },
        ],
        segments: [],
        continuity: [{ axis: "x", at: 1000, maxJump: 12 }],
    },
    /**
     * The same hand-off through a motion component.
     */
    "component-interrupt": {
        duration: 2000,
        component: true,
        start: ({ controls }) =>
            controls.start({ x: 400, y: 400, transition: linear(4) }),
        steps: [
            {
                at: 1000,
                run: ({ controls }) =>
                    controls.start({ x: 400, transition: linear(4) }),
            },
        ],
        segments: [
            { axis: "x", from: 100, to: 1000, speed: 100 },
            { axis: "y", from: 100, to: 2000, speed: 100 },
        ],
        continuity: [{ axis: "x", at: 1000, maxJump: 8 }],
    },
    /**
     * A motion component's sibling value driven from the main thread.
     */
    "component-sibling": {
        duration: 2000,
        component: true,
        externalY: true,
        start: ({ controls }) =>
            controls.start({ x: 400, transition: linear(4) }),
        steps: [{ at: 1000, run: ({ y }) => drive(y) }],
        segments: [
            { axis: "x", from: 100, to: 2000, speed: 100 },
            { axis: "y", from: 100, to: 1000, speed: 0 },
            { axis: "y", from: 1050, to: 2000, speed: 100 },
        ],
    },
    /**
     * A motion component's animation stopped mid-flight holds its value.
     */
    "component-stop": {
        duration: 2000,
        component: true,
        start: ({ controls }) =>
            controls.start({ x: 400, y: 400, transition: linear(4) }),
        steps: [{ at: 1000, run: ({ controls }) => controls.stop() }],
        segments: [
            { axis: "x", from: 100, to: 1000, speed: 100 },
            { axis: "y", from: 100, to: 1000, speed: 100 },
            { axis: "x", from: 1050, to: 2000, speed: 0 },
            { axis: "y", from: 1050, to: 2000, speed: 0 },
        ],
        continuity: [
            { axis: "x", at: 1000, maxJump: 8 },
            { axis: "y", at: 1000, maxJump: 8 },
        ],
    },
}

function analyse(samples: Sample[], scenario: Scenario) {
    const drops: string[] = []
    const frames: Record<string, number> = {}

    for (const { axis, from, to, speed } of scenario.segments) {
        const key = `${axis} ${from}-${to}`
        frames[key] = 0

        for (let i = 1; i < samples.length; i++) {
            const prev = samples[i - 1]
            const sample = samples[i]
            if (prev.t < from || sample.t > to) continue

            frames[key]++
            const dt = (sample.t - prev.t) / 1000
            const delta = sample[axis] - prev[axis]
            const expected = speed * dt
            const tolerance = speed
                ? Math.max(1.5, Math.abs(expected) * 0.35)
                : 0.5

            if (Math.abs(delta - expected) > tolerance) {
                drops.push(
                    `${axis} at ${Math.round(sample.t)}ms moved ${delta.toFixed(
                        1
                    )}px, expected ${expected.toFixed(1)}px`
                )
            }
        }

        /**
         * Enough frames must have been recorded for the window to mean
         * anything. Headless browsers run at 60fps or more.
         */
        if (frames[key] < ((to - from) / 1000) * 30) {
            drops.push(`${key}: only ${frames[key]} frames recorded`)
        }
    }

    for (const { axis, at, maxJump } of scenario.continuity || []) {
        const after = samples.findIndex((sample) => sample.t >= at)
        if (after < 1) {
            drops.push(`${axis}: no samples around ${at}ms`)
            continue
        }
        for (
            let i = after;
            i < samples.length && samples[i].t < at + 100;
            i++
        ) {
            const jump = Math.abs(samples[i][axis] - samples[i - 1][axis])
            if (jump > maxJump) {
                drops.push(
                    `${axis} jumped ${jump.toFixed(1)}px at ${Math.round(
                        samples[i].t
                    )}ms`
                )
            }
        }
    }

    if (scenario.reference) {
        /**
         * Accelerated animations run on the frame's timestamp and main
         * thread ones a few ms behind it, so allow a quarter of a frame's
         * movement at the reference's current speed.
         */
        for (let i = 1; i < samples.length; i++) {
            const { y, refY, t } = samples[i]
            if (refY === undefined || t < 100) continue
            const diff = Math.abs(y - refY)
            const tolerance = 1 + Math.abs(refY - samples[i - 1].refY!) / 4
            if (diff > tolerance) {
                drops.push(
                    `y differs from reference by ${diff.toFixed(
                        1
                    )}px at ${Math.round(t)}ms`
                )
            }
        }
    }

    return { drops, frames, samples }
}

export const App = () => {
    const name =
        new URL(window.location.href).searchParams.get("scenario") ||
        "interrupt-sibling"
    const scenario = scenarios[name]
    const [scope, animateBox] = useAnimate()
    const controls = useAnimationControls()
    const box = useRef<HTMLDivElement>(null)
    const reference = useRef<HTMLDivElement>(null)
    const y = useMotionValue(0)
    const [result, setResult] = useState("")

    useEffect(() => {
        const element = box.current!
        const samples: Sample[] = []
        const origin = element.getBoundingClientRect()
        const referenceOrigin = reference.current?.getBoundingClientRect()

        const cancelEffect =
            scenario.externalY && !scenario.component
                ? styleEffect(element, { y })
                : undefined

        const context: Context = {
            a: animateBox as typeof animate,
            box: element,
            y,
            reference: reference.current!,
            controls,
        }
        context.first = scenario.start(context)
        const startTime = performance.now()

        /**
         * Measure after Motion's render step so main-thread writes made this
         * frame are included, as they are in the frame the browser paints.
         */
        const record = () => {
            const rect = element.getBoundingClientRect()
            const sample: Sample = {
                t: performance.now() - startTime,
                x: rect.left - origin.left,
                y: rect.top - origin.top,
            }
            if (referenceOrigin) {
                sample.refY =
                    reference.current!.getBoundingClientRect().top -
                    referenceOrigin.top
            }
            samples.push(sample)
        }
        frame.postRender(record, true)

        const timers = scenario.steps.map(({ at, run }) =>
            setTimeout(() => run(context), at)
        )
        timers.push(
            setTimeout(() => {
                cancelFrame(record)
                setResult(JSON.stringify(analyse(samples, scenario)))
            }, scenario.duration)
        )

        return () => {
            cancelFrame(record)
            timers.forEach(clearTimeout)
            cancelEffect?.()
        }
    }, [])

    const style = {
        width: 50,
        height: 50,
        background: "red",
    }

    return (
        <div ref={scope}>
            {scenario.component ? (
                <motion.div
                    id="box"
                    ref={box}
                    animate={controls}
                    style={scenario.externalY ? { ...style, y } : style}
                />
            ) : (
                <div id="box" ref={box} style={style} />
            )}
            {scenario.reference && (
                <div
                    id="reference"
                    ref={reference}
                    style={{ ...style, background: "blue" }}
                />
            )}
            <div id="result">{result}</div>
        </div>
    )
}
