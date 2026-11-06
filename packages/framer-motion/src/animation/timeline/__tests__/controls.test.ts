/**
 * Playback calls made one after another in a task are queued and
 * combined. They must end where the same calls made one at a time do.
 */

// window.requestAnimationFrame never fires, so only processFrame() runs frames
;(window as any).requestAnimationFrame = jest.fn(() => 0)

const { MotionGlobalConfig } = require("motion-utils")
const { animateSingleValue, motionValue, processFrame } = require("motion-dom")
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
 * after each of them. Or, mixed, animations of different durations, as
 * animate() makes for values with their own transitions, so one can
 * finish while the others run.
 */
function create(isMixed = false) {
    const values = [motionValue(0), motionValue(0), motionValue(0)]
    const tl = isMixed
        ? new Timeline(
              [],
              {},
              values.map((v, i) =>
                  animateSingleValue(v, [0, 100], {
                      duration: [0.2, 2, 0.6][i],
                      ease: "linear",
                  })
              )
          )
        : new Timeline(
              values.map((v, i) => [v, 100, { duration: 1, at: i * 0.5 }]),
              linear
          )
    return { tl, values }
}

/**
 * Run frames up to `ms` after the start.
 */
async function advance(ms: number) {
    await Promise.resolve()
    processFrame(start + 16)
    processFrame(start + ms)
    await Promise.resolve()
    await Promise.resolve()
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

async function settle(tl: any, values: any[], from = 0) {
    await Promise.resolve()
    processFrame(start + from + 16)
    processFrame(start + from + 250)
    return {
        ...read(tl),
        values: values.map((v) => Math.round(v.get() * 100) / 100),
    }
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

    /**
     * Before the calls, frames run for `from` ms, so some animations can
     * have finished, and `setup` is called in an earlier task.
     */
    test.each([
        ["a sequence", false, 0, undefined],
        ["a finished sequence", false, 3000, undefined],
        ["mixed durations, one finished", true, 1000, undefined],
        ["mixed durations, paused after one finished", true, 1000, "pause"],
        ["mixed durations, reversed after one finished", true, 1000, "reverse"],
    ])(
        "%s: calls end where the same calls made one at a time do",
        async (_, isMixed, from, setup) => {
            for (let seed = 1; seed <= 300; seed++) {
                const calls = randomCalls(seed, 12)
                const queued = create(isMixed)
                const expected = create(isMixed)
                await advance(from)
                if (setup) {
                    queued.tl[setup]()
                    expected.tl[setup]()
                    await Promise.resolve()
                }

                calls.forEach((c) => call(queued.tl, c))
                for (const c of calls) {
                    call(expected.tl, c)
                    await Promise.resolve()
                }

                expect(read(queued.tl)).toEqual(read(expected.tl))
                expect(await settle(queued.tl, queued.values, from)).toEqual(
                    await settle(expected.tl, expected.values, from)
                )
                queued.tl.stop()
                expected.tl.stop()
            }
        }
    )

    test.each([
        ["reverse, pause", (tl: any) => (tl.reverse(), tl.pause())],
        [
            "pause, reverse, pause",
            (tl: any) => (tl.pause(), tl.reverse(), tl.pause()),
        ],
    ])(
        "%s, seek and speed up an animation that finished before the others",
        async (_, before) => {
            const { tl, values } = create(true)
            await advance(1000)
            expect(values[0].get()).toBe(100)

            before(tl)
            tl.time = 0.5
            tl.speed = 1
            await advance(1100)

            expect(values[0].get()).toBe(100)
            expect(values[1].get()).toBeCloseTo(25)
        }
    )

    test("seeking a finished timeline sets its values straight away", async () => {
        const v = motionValue(0)
        const tl = new Timeline([[v, 100, { duration: 0.1 }]], linear)
        await advance(200)
        expect(v.get()).toBe(100)

        tl.pause()
        tl.time = 0.05
        expect(v.get()).toBe(50)
    })

    test("a call that throws doesn't stop the calls after it", async () => {
        const { tl } = create()
        await Promise.resolve()
        const error = new Error("play")
        jest.spyOn(tl.group, "play").mockImplementationOnce(() => {
            throw error
        })

        tl.pause()
        tl.play()
        tl.speed = 2
        expect(() => tl.state).toThrow(error)
        expect(tl.group.animations[0].speed).toBe(2)
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
