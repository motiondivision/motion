/**
 * Timeline callbacks and repeats with frames at chosen times, as a loaded
 * machine (or a busy main thread) can land a frame anywhere, including
 * exactly on a repeat boundary or several repeats later.
 */

// window.requestAnimationFrame never fires, so only processFrame() runs frames
;(window as any).requestAnimationFrame = jest.fn(() => 0)

const { MotionGlobalConfig } = require("motion-utils")
const { motionValue, processFrame } = require("motion-dom")
const { Timeline } = require("..")

const linear = { defaultTransition: { ease: "linear" as const } }

/**
 * Create a timeline at `start` ms, then process a frame at each of `times`.
 */
async function run(
    options: object,
    times: number[],
    setup: (tl: any) => void,
    start = 0
) {
    processFrame(start)
    const v = motionValue(0)
    const tl = new Timeline([[v, 100, { duration: 0.1 }]], {
        ...linear,
        ...options,
    })
    setup(tl)
    // The timeline builds in a microtask
    await Promise.resolve()
    times.forEach((t) => processFrame(start + t))
    // Not tl itself, which is thenable
    return { tl }
}

let start = 0
const nextStart = () => (start += 10000)

beforeEach(() => {
    MotionGlobalConfig.useManualTiming = true
})

afterEach(() => {
    MotionGlobalConfig.useManualTiming = false
})

describe("timeline repeats with frames at chosen times", () => {
    test("a frame on a repeat boundary doesn't fire callbacks extra", async () => {
        const callback = jest.fn()
        await run(
            { repeat: 2 },
            [0, 30, 100, 120, 200, 220, 300, 320],
            (tl) => tl.call(callback, 0.05),
            nextStart()
        )

        expect(callback.mock.calls).toEqual([[1], [1], [1]])
    })

    test("a frame that skips a repeat fires callbacks for it", async () => {
        const callback = jest.fn()
        const onRepeat = jest.fn()
        await run(
            { repeat: 2, onRepeat },
            [0, 30, 260, 300],
            (tl) => tl.call(callback, 0.05),
            nextStart()
        )

        expect(callback.mock.calls).toEqual([[1], [1], [1]])
        expect(onRepeat).toHaveBeenCalledTimes(2)
    })

    test("one frame across every repeat fires each callback once a repeat", async () => {
        const callback = jest.fn()
        await run(
            { repeat: 2 },
            [0, 1000],
            (tl) => tl.call(callback, 0.05),
            nextStart()
        )

        expect(callback.mock.calls).toEqual([[1], [1], [1]])
    })

    test("a frame at the end of a reverse repeat fires backwards once", async () => {
        const callback = jest.fn()
        await run(
            { repeat: 1, repeatType: "reverse" },
            [0, 30, 80, 110, 160, 200],
            (tl) => tl.call(callback, 0.09),
            nextStart()
        )

        expect(callback.mock.calls).toEqual([[1], [-1]])
    })

    test("a reverse repeat turns around within one frame", async () => {
        const callback = jest.fn()
        await run(
            { repeat: 1, repeatType: "reverse" },
            [0, 80, 120, 200],
            (tl) => tl.call(callback, 0.09),
            nextStart()
        )

        expect(callback.mock.calls).toEqual([[1], [-1]])
    })

    test("a pause in a skipped repeat stops there", async () => {
        const { tl } = await run(
            { repeat: 2 },
            [0, 30, 260],
            (tl) => tl.addPause(0.05),
            nextStart()
        )

        // The first repeat pauses at 0.05, so no repeats are skipped
        expect(tl.time).toBeCloseTo(0.05)
    })
})
