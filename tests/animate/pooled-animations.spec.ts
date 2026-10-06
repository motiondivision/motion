import { expect, Page, test } from "@playwright/test"

/**
 * The values of one animate() call are one pool. Each value can be
 * interrupted, read and handed between the compositor and the main thread
 * on its own, while the pool's controls act on every value together.
 * Each test records the element every frame and checks that no frame
 * jumps or stalls.
 */

interface Frame {
    t: number
    ts: number
    x: number
    y: number
    scale: number
    rotate: number
    opacity: number
    count: number
    animations: number
}

declare global {
    interface Window {
        Motion: any
        nextFrames: (count?: number) => Promise<void>
        wait: (ms: number) => Promise<void>
        recordFrames: (element: Element, ms: number) => Promise<Frame[]>
    }
}

async function load(page: Page) {
    await page.goto("animate/animate-independent-transforms.html")
    await page.waitForFunction(() => (window as any).ready)
}

/**
 * Rounding and timing differences allow up to this many px of difference
 * per frame.
 */
const tolerance = 2.5

/**
 * When a frame shows the element: the compositor samples WAAPI animations
 * at the frame's timeline time, and JS animations sample at Motion's frame
 * timestamp, which is later when the main thread is busy.
 */
const timeOf = (frame: Frame) => (frame.animations ? frame.t : frame.ts)

type Key = "x" | "y" | "rotate" | "opacity"

/**
 * Every frame moves at speed (units per ms), within tolerance.
 */
function expectSteady(
    frames: Frame[],
    speed: number,
    key: Key = "x",
    limit = tolerance
) {
    for (let i = 1; i < frames.length; i++) {
        const dt = timeOf(frames[i]) - timeOf(frames[i - 1])
        const dx = frames[i][key] - frames[i - 1][key]
        expect(
            Math.abs(dx - speed * dt),
            `frame ${i}: ${key} moved ${dx.toFixed(4)} in ${dt.toFixed(1)}ms`
        ).toBeLessThan(limit)
    }
}

/**
 * No frame moves faster than speed (units per ms), within tolerance.
 */
function expectNoJump(
    frames: Frame[],
    speed: number,
    key: Key,
    limit = tolerance
) {
    for (let i = 1; i < frames.length; i++) {
        const dt = timeOf(frames[i]) - timeOf(frames[i - 1])
        const dx = frames[i][key] - frames[i - 1][key]
        expect(
            Math.abs(dx),
            `frame ${i}: ${key} moved ${dx.toFixed(4)} in ${dt.toFixed(1)}ms`
        ).toBeLessThan(speed * dt + limit)
    }
}

/**
 * For animations that change speed, no frame's speed differs from the one
 * before by more than limit (units per ms).
 */
function expectSmooth(frames: Frame[], limit: number, key: Key = "x") {
    const speed = (a: Frame, b: Frame) =>
        (b[key] - a[key]) / (timeOf(b) - timeOf(a))

    for (let i = 2; i < frames.length; i++) {
        const before = speed(frames[i - 2], frames[i - 1])
        const after = speed(frames[i - 1], frames[i])
        expect(
            Math.abs(after - before),
            `frame ${i}: ${before.toFixed(3)} then ${after.toFixed(3)} per ms`
        ).toBeLessThan(limit)
    }
}

test.describe("pooled animations", () => {
    test.use({ viewport: { width: 1000, height: 500 } })

    test.beforeEach(async ({ page }) => load(page))

    test("composes a pool's transforms into one animation with two keyframes and native easing", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            window.Motion.animate(
                element,
                { x: 100, y: 50, rotate: 90, opacity: 0.5 },
                { duration: 1, ease: "easeInOut" }
            )
            await window.nextFrames(2)
            return element.getAnimations().map((animation) => {
                const effect = animation.effect as KeyframeEffect
                const keyframes = effect.getKeyframes()
                return {
                    properties: Object.keys(keyframes[0]).filter(
                        (key) => key === "transform" || key === "opacity"
                    ),
                    keyframes: keyframes.length,
                    easing: effect.getTiming().easing,
                }
            })
        })

        const transform = result.find((a) => a.properties[0] === "transform")
        expect(result.length).toBe(2)
        expect(transform).toEqual({
            properties: ["transform"],
            keyframes: 2,
            easing: "ease-in-out",
        })
    })

    test("interrupting one value leaves the rest of its pool on the compositor", async ({
        page,
    }) => {
        const frames = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            animate(
                element,
                { x: 600, y: 300 },
                { duration: 3, ease: "linear" }
            )
            await window.wait(300)
            const recording = window.recordFrames(element, 1000)
            await window.wait(300)
            animate(element, { y: 0 }, { duration: 3, ease: "linear" })
            return recording
        })

        expect(frames.every((f) => f.count === 1)).toBe(true)
        // x carries on at 600px over 3s.
        expectSteady(frames, 0.2)
        // y turns around without a jump.
        expectNoJump(frames, 0.1, "y")
        const top = frames.findIndex(
            (f, i) => i && f.y < frames[i - 1].y - 0.01
        )
        expect(top).toBeGreaterThan(2)
        expect(frames[frames.length - 1].y).toBeLessThan(frames[top].y)
    })

    test("an interrupted transform hands its velocity to a spring", async ({
        page,
    }) => {
        const frames = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            animate(element, { x: 600 }, { duration: 3, ease: "linear" })
            await window.wait(300)
            const recording = window.recordFrames(element, 800)
            await window.wait(300)
            animate(
                element,
                { x: 600 },
                { type: "spring", stiffness: 10, damping: 10 }
            )
            return recording
        })

        expect(frames.every((f) => f.count === 1)).toBe(true)
        /**
         * The spring accelerates at under 0.004px/ms², so speed changes
         * by under 0.1px/ms per frame. Starting from rest would drop
         * 0.2px/ms in one frame.
         */
        expectSmooth(frames, 0.1)
    })

    test("pause, seek and speed act on every value in a pool", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            const animation = animate(
                element,
                { x: 600, opacity: [0, 1] },
                { duration: 3, ease: "linear" }
            )
            await window.wait(300)
            animation.pause()
            await window.nextFrames(2)
            const paused = (await window.recordFrames(element, 200)).slice(1)
            animation.time = 1.5
            await window.nextFrames(2)
            const [seeked] = await window.recordFrames(element, 0)
            animation.speed = 2
            animation.play()
            await window.nextFrames(2)
            const playing = await window.recordFrames(element, 300)
            return { paused, seeked, playing }
        })

        const { paused, seeked, playing } = result
        expect(paused.every((f) => f.count === 1)).toBe(true)
        expectSteady(paused, 0, "x", 0.01)
        expectSteady(paused, 0, "opacity", 0.001)

        expect(seeked.x).toBeCloseTo(300, 0)
        expect(seeked.opacity).toBeCloseTo(0.5, 2)

        expect(playing.every((f) => f.count === 1)).toBe(true)
        expectSteady(playing, 0.4)
        expectSteady(playing, 2 / 3000, "opacity", 0.01)
    })

    test("opacity hands off from WAAPI to the main thread without a jump", async ({
        page,
    }) => {
        const frames = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            animate(
                element,
                { opacity: [0, 1] },
                { duration: 3, ease: "linear" }
            )
            await window.wait(300)
            const recording = window.recordFrames(element, 800)
            await window.wait(300)
            /**
             * Mirrored repeats run on the main thread.
             */
            animate(
                element,
                { opacity: 1 },
                {
                    duration: 3,
                    ease: "linear",
                    repeat: 1,
                    repeatType: "mirror",
                }
            )
            return recording
        })

        const handoff = frames.findIndex((f) => !f.animations)
        expect(handoff).toBeGreaterThan(2)
        expect(frames.slice(0, handoff).every((f) => f.animations)).toBe(true)
        expect(frames.slice(handoff).every((f) => !f.animations)).toBe(true)
        // Under 1 per 3s, with a frame's worth of tolerance.
        expectNoJump(frames, 1 / 3000, "opacity", 0.01)
        expect(frames[handoff].opacity).toBeGreaterThan(0.15)
    })

    test("stop() leaves every value where it was", async ({ page }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            const animation = animate(
                element,
                { x: 600, opacity: [0, 1] },
                { duration: 3, ease: "linear" }
            )
            await window.wait(300)
            const before = await window.recordFrames(element, 0)
            animation.stop()
            await window.nextFrames(2)
            const after = await window.recordFrames(element, 200)
            return { before: before[0], after }
        })

        const { before, after } = result
        expect(after.every((f) => !f.animations)).toBe(true)
        // Stopped within a frame or two of the last recorded frame.
        expect(Math.abs(after[0].x - before.x)).toBeLessThan(0.2 * 40)
        expect(Math.abs(after[0].opacity - before.opacity)).toBeLessThan(0.02)
        expectSteady(after, 0, "x", 0.01)
        expectSteady(after, 0, "opacity", 0.001)
    })

    test("a pool finishes once every value has, leaving nothing running", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            let finished = 0
            const start = performance.now()
            await animate(
                element,
                { x: 100, opacity: 0.5 },
                { duration: 0.2, x: { duration: 0.4 } }
            ).then(() => finished++)
            const elapsed = performance.now() - start
            await window.nextFrames(2)
            const [frame] = await window.recordFrames(element, 0)
            return {
                finished,
                elapsed,
                frame,
                transform: element.style.transform,
            }
        })

        expect(result.finished).toBe(1)
        expect(result.elapsed).toBeGreaterThan(380)
        expect(result.frame.animations).toBe(0)
        expect(result.frame.x).toBeCloseTo(100, 1)
        expect(result.frame.opacity).toBeCloseTo(0.5, 2)
        expect(result.transform).toBe("translateX(100px)")
    })

    test("a transition's onUpdate keeps transforms on the main thread", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            const values: number[] = []
            animate(
                element,
                { x: 100 },
                {
                    duration: 0.5,
                    ease: "linear",
                    onUpdate: (x: number) => values.push(x),
                }
            )
            await window.wait(300)
            const [frame] = await window.recordFrames(element, 0)
            return { count: frame.count, updates: values.length }
        })

        expect(result.count).toBe(0)
        expect(result.updates).toBeGreaterThan(5)
    })
})
