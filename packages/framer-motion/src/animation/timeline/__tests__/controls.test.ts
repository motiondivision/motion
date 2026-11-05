/**
 * Playback calls made one after another in a task are queued and
 * combined. They must end where the same calls made one at a time do.
 */

// window.requestAnimationFrame never fires, so only processFrame() runs frames
;(window as any).requestAnimationFrame = jest.fn(() => 0)

const { MotionGlobalConfig } = require("motion-utils")
const { motionValue, processFrame } = require("motion-dom")
const { Timeline } = require("..")

const linear = { defaultTransition: { ease: "linear" as const } }

let start = 0

beforeEach(() => {
    MotionGlobalConfig.useManualTiming = true
    start += 10000
    processFrame(start)
})

afterEach(() => {
    MotionGlobalConfig.useManualTiming = false
})

/**
 * A sequence of three values, so the playhead can sit in, before or
 * after each of them.
 */
function create() {
    const values = [motionValue(0), motionValue(0), motionValue(0)]
    const tl = new Timeline(
        values.map((v, i) => [v, 100, { duration: 1, at: i * 0.5 }]),
        linear
    )
    return { tl, values }
}

type Call = ["pause"] | ["play"] | ["reverse"] | ["time" | "speed", number]

function call(tl: any, [name, value]: Call) {
    name === "time" || name === "speed" ? (tl[name] = value) : tl[name]()
}

/**
 * A repeatable list of random calls.
 */
function randomCalls(seed: number, length: number) {
    const random = () => {
        seed = (seed * 16807) % 2147483647
        return seed / 2147483647
    }
    const calls: Call[] = []
    for (let i = 0; i < length; i++) {
        const r = random()
        calls.push(
            r < 0.2
                ? ["pause"]
                : r < 0.4
                ? ["play"]
                : r < 0.55
                ? ["reverse"]
                : r < 0.85
                ? ["time", Math.round(random() * 2500) / 1000]
                : ["speed", [-2, -1, 0.5, 1, 3][Math.floor(random() * 5)]]
        )
    }
    return calls
}

const read = (tl: any) => ({
    time: tl.time,
    speed: tl.speed,
    state: tl.state,
})

async function settle(tl: any, values: any[]) {
    await Promise.resolve()
    processFrame(start + 16)
    processFrame(start + 250)
    return { ...read(tl), values: values.map((v) => v.get()) }
}

describe("timeline playback calls", () => {
    test("combine calls before the last seek", async () => {
        const { tl } = create()
        await Promise.resolve()

        const group = tl.group
        const pause = jest.spyOn(group, "pause")
        const seek = jest.spyOn(group, "time", "set")

        for (let k = 0; k < 100; k++) {
            tl.pause()
            tl.time = (((k * 37) % 100) / 100) * 2
            tl.reverse()
            tl.play()
        }
        await Promise.resolve()

        expect(pause.mock.calls.length).toBeLessThan(4)
        expect(seek.mock.calls.length).toBeLessThan(4)
        expect(read(tl)).toEqual({ time: 1.26, speed: 1, state: "running" })
    })

    test("reads between calls see every call so far", () => {
        const { tl } = create()

        tl.pause()
        tl.time = 0.2
        expect(tl.time).toBeCloseTo(0.2)
        tl.time = 0.4
        tl.speed = -1
        tl.play()
        expect(tl.state).toBe("running")
        expect(tl.time).toBeCloseTo(0.4)
        tl.pause()
        expect(tl.state).toBe("paused")
    })

    test("end where the same calls made one at a time do", async () => {
        for (let seed = 1; seed <= 40; seed++) {
            const calls = randomCalls(seed, 30)

            const queued = create()
            await Promise.resolve()
            calls.forEach((c) => call(queued.tl, c))
            const expected = create()
            await Promise.resolve()
            for (const c of calls) {
                call(expected.tl, c)
                await Promise.resolve()
            }

            expect(read(queued.tl)).toEqual(read(expected.tl))
            expect(await settle(queued.tl, queued.values)).toEqual(
                await settle(expected.tl, expected.values)
            )
            queued.tl.stop()
            expected.tl.stop()
        }
    })

    test("play a finished timeline again after queued calls", async () => {
        const onComplete = jest.fn()
        const v = motionValue(0)
        const tl = new Timeline([[v, 100, { duration: 0.1 }]], {
            ...linear,
            onComplete,
        })
        await Promise.resolve()
        processFrame(start + 16)
        processFrame(start + 200)
        await tl
        expect(onComplete).toHaveBeenCalledTimes(1)

        tl.pause()
        tl.time = 0.05
        tl.play()
        processFrame(start + 216)
        expect(v.get()).toBeGreaterThan(40)
        expect(v.get()).toBeLessThan(100)

        processFrame(start + 400)
        await tl
        expect(v.get()).toBe(100)
        expect(onComplete).toHaveBeenCalledTimes(2)
    })
})

// A module, so its names don't clash with other script-style test files
export {}
