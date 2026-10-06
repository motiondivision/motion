import { MotionGlobalConfig } from "motion-utils"
import { frameData } from "../../../frameloop/frame-data"
import { time } from "../../../frameloop/sync-time"
import { motionValue, MotionValue } from "../../../value"
import { animateValues } from "../../animate/effects"
import { Driver } from "../../drivers/types"
import { Pool } from "../Pool"

/**
 * A driver stepped by hand, so tests can interrupt animations mid-flight
 * and check the exact frame every value receives.
 */
function manualDriver() {
    const updates = new Set<(timestamp: number) => void>()
    let created = 0
    let now = 0

    const driver: Driver = (update) => {
        created++
        return {
            start: () => void updates.add(update),
            stop: () => void updates.delete(update),
            now: () => now,
        }
    }

    return {
        driver,
        step(timestamp: number) {
            now = timestamp
            frameData.timestamp = timestamp
            time.set(timestamp)
            updates.forEach((update) => update(timestamp))
        },
        get created() {
            return created
        },
        get running() {
            return updates.size
        },
    }
}

function setup(initial: Record<string, number> = { x: 0, y: 0 }) {
    const values: Record<string, MotionValue> = {}
    for (const key in initial) values[key] = motionValue(initial[key])
    const clock = manualDriver()
    const getValue = (key: string) => values[key]

    const animate = (
        keyframes: Record<string, number | number[]>,
        transition: Record<string, any> = {}
    ) => {
        /**
         * Per-value transitions replace the root one, so each needs the
         * driver too.
         */
        for (const key in transition) {
            if (typeof transition[key] === "object") {
                transition[key].driver = clock.driver
            }
        }

        return animateValues(getValue, keyframes, {
            duration: 0.1,
            ease: "linear",
            driver: clock.driver,
            ...transition,
        })[0] as Pool
    }

    return { values, clock, animate }
}

beforeEach(() => {
    MotionGlobalConfig.useManualTiming = true
    frameData.timestamp = 0
    time.set(0)
})

afterEach(() => {
    MotionGlobalConfig.useManualTiming = false
})

describe("Pool", () => {
    test("drives every value from one frameloop subscription", () => {
        const { values, clock, animate } = setup()
        const pool = animate({ x: 100, y: 200 })

        expect(pool).toBeInstanceOf(Pool)
        expect(clock.created).toBe(1)
        expect(values.x.animation).toBeDefined()
        expect(values.y.animation).toBeDefined()

        clock.step(0)
        clock.step(50)
        expect(values.x.get()).toBe(50)
        expect(values.y.get()).toBe(100)
    })

    test("values keep their own timing and the pool finishes when all do", async () => {
        const { values, clock, animate } = setup()
        const pool = animate(
            { x: 100, y: 100 },
            { y: { duration: 0.2, ease: "linear" } }
        )
        let finished = false
        pool.finished.then(() => (finished = true))

        clock.step(0)
        clock.step(100)
        expect(values.x.get()).toBe(100)
        expect(values.y.get()).toBe(50)
        expect(values.x.isAnimating()).toBe(false)
        expect(values.y.isAnimating()).toBe(true)
        expect(pool.state).toBe("running")

        clock.step(200)
        await Promise.resolve()
        expect(values.y.get()).toBe(100)
        expect(pool.state).toBe("finished")
        expect(finished).toBe(true)
        expect(clock.running).toBe(0)
    })

    test("an interrupting animation takes a value with its velocity", async () => {
        const { values, clock, animate } = setup()
        const first = animate({ x: 100, y: 100 })
        let firstFinished = false
        first.finished.then(() => (firstFinished = true))

        clock.step(0)
        clock.step(40)
        clock.step(50)
        expect(values.x.get()).toBe(50)

        const second = animate({ x: 0 })

        expect(values.x.animation).not.toBe(values.y.animation)
        expect(values.x.getVelocity()).toBeCloseTo(1000)
        expect(values.y.isAnimating()).toBe(true)

        /**
         * The first pool carries on with y, the second starts x from 50.
         */
        clock.step(100)
        expect(values.y.get()).toBe(100)
        expect(values.x.get()).toBe(25)
        expect(first.state).toBe("idle")
        await Promise.resolve()
        expect(firstFinished).toBe(false)

        clock.step(150)
        expect(values.x.get()).toBe(0)
        await Promise.resolve()
        expect(second.state).toBe("finished")
        expect(clock.running).toBe(0)
    })

    test("a pool that owns no values winds down", () => {
        const { values, clock, animate } = setup()
        const first = animate({ x: 100, y: 100 })
        clock.step(0)
        clock.step(20)

        animate({ x: 0, y: 0 })
        expect(first.state).toBe("idle")
        expect(clock.created).toBe(2)
        expect(clock.running).toBe(1)

        clock.step(40)
        expect(values.x.get()).toBe(16)
    })

    test("stop() leaves values where they are without finishing", async () => {
        const { values, clock, animate } = setup()
        const pool = animate({ x: 100 })
        let finished = false
        pool.finished.then(() => (finished = true))

        clock.step(0)
        clock.step(30)
        pool.stop()

        expect(values.x.get()).toBe(30)
        expect(values.x.isAnimating()).toBe(false)
        expect(clock.running).toBe(0)
        await Promise.resolve()
        expect(finished).toBe(false)
    })

    test("pause, play, time and speed act on every value", () => {
        const { values, clock, animate } = setup()
        const pool = animate({ x: 100, y: 200 })
        clock.step(0)
        clock.step(20)

        pool.pause()
        expect(pool.state).toBe("paused")
        clock.step(60)
        expect(values.x.get()).toBe(20)
        expect(values.y.get()).toBe(40)
        expect(pool.time).toBeCloseTo(0.02)

        pool.time = 0.05
        expect(values.x.get()).toBe(50)
        expect(values.y.get()).toBe(100)

        pool.play()
        clock.step(70)
        expect(values.x.get()).toBe(60)

        pool.speed = 2
        clock.step(80)
        expect(values.x.get()).toBe(80)
        expect(values.y.get()).toBe(160)
        expect(pool.speed).toBe(2)
    })

    test("complete() jumps every value to its end", async () => {
        const { values, clock, animate } = setup()
        const pool = animate({ x: 100, y: 200 })
        clock.step(0)
        clock.step(20)

        pool.complete()
        await Promise.resolve()

        expect(values.x.get()).toBe(100)
        expect(values.y.get()).toBe(200)
        expect(pool.state).toBe("finished")
        expect(values.x.isAnimating()).toBe(false)
    })

    test("cancel() returns every value to its start", () => {
        const { values, clock, animate } = setup()
        const pool = animate({ x: 100, y: 200 })
        clock.step(0)
        clock.step(20)

        pool.cancel()

        expect(values.x.get()).toBe(0)
        expect(values.y.get()).toBe(0)
        expect(clock.running).toBe(0)
    })

    test("per-value callbacks fire for their own value", () => {
        const { clock, animate } = setup()
        const xUpdates: number[] = []
        const onComplete = jest.fn()

        animate(
            { x: 100, y: 100 },
            {
                x: {
                    duration: 0.1,
                    ease: "linear",
                    onUpdate: (v: number) => xUpdates.push(v),
                },
                y: { onComplete, duration: 0.05 },
            }
        )

        clock.step(0)
        clock.step(50)
        expect(xUpdates).toEqual([0, 50])
        expect(onComplete).toHaveBeenCalledTimes(1)
    })

    test("repeat, reverse and delay follow the track's own timing", () => {
        const { values, clock, animate } = setup()
        animate(
            { x: 100, y: 100 },
            {
                x: {
                    duration: 0.1,
                    ease: "linear",
                    repeat: 1,
                    repeatType: "reverse",
                },
                y: { duration: 0.1, ease: "linear", delay: 0.1 },
            }
        )

        clock.step(0)
        clock.step(50)
        expect(values.x.get()).toBe(50)
        expect(values.y.get()).toBe(0)

        clock.step(150)
        expect(values.x.get()).toBe(50)
        expect(values.y.get()).toBe(50)
    })

    test("springs hand their velocity to an interrupting spring", () => {
        const { values, clock, animate } = setup()
        animate({ x: 500 }, { type: "spring", stiffness: 100, damping: 10 })
        clock.step(0)
        clock.step(100)
        clock.step(110)

        const before = values.x.get()
        const velocity = values.x.getVelocity()
        expect(velocity).toBeGreaterThan(0)

        animate({ x: 0 }, { type: "spring", stiffness: 100, damping: 10 })
        clock.step(120)

        /**
         * A spring that inherits the outgoing velocity overshoots away from
         * its new target before turning back.
         */
        expect(values.x.get()).toBeGreaterThan(before)
    })
})
