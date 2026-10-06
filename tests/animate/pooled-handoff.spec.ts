import { expect, Page, test } from "@playwright/test"

/**
 * Pooled animations run transforms on the compositor through the
 * individual translate, scale and rotate properties, and move them to the
 * main thread when something there needs to write the same property.
 * The element must carry on from exactly where it was, at the same speed:
 * no jump and no stalled frame. Each test records the element every frame
 * across the hand-off and checks every frame's movement.
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
}

declare global {
    interface Window {
        Motion: any
        wait: (ms: number) => Promise<void>
        recordFrames: (element: Element, ms: number) => Promise<Frame[]>
    }
}

async function load(page: Page) {
    await page.goto("animate/animate-pooled-transforms.html")
    await page.waitForFunction(() => (window as any).ready)
}

/**
 * Rounding and timing differences allow up to this many px of difference
 * per frame.
 */
const tolerance = 2.5

/**
 * When a frame shows the element: the compositor samples WAAPI animations
 * at the frame's timeline time, and main-thread animations sample at
 * Motion's frame timestamp.
 */
const timeOf = (frame: Frame) => (frame.count ? frame.t : frame.ts)

/**
 * Every frame moves at speed (px per ms), within tolerance.
 */
function expectSteady(
    frames: Frame[],
    speed: number,
    key: "x" | "y" = "x",
    from = 1,
    to = frames.length
) {
    for (let i = Math.max(from, 1); i < to; i++) {
        const dt = timeOf(frames[i]) - timeOf(frames[i - 1])
        const dx = frames[i][key] - frames[i - 1][key]
        expect(
            Math.abs(dx - speed * dt),
            `frame ${i}: moved ${dx.toFixed(2)}px in ${dt.toFixed(1)}ms`
        ).toBeLessThan(tolerance)
    }
}

/**
 * No frame moves further than maxSpeed (px per ms) allows, so a value
 * never jumps between two frames.
 */
function expectContinuous(frames: Frame[], maxSpeed: number) {
    for (let i = 1; i < frames.length; i++) {
        const dt = timeOf(frames[i]) - timeOf(frames[i - 1])
        const dx = Math.abs(frames[i].x - frames[i - 1].x)
        expect(
            dx,
            `frame ${i}: moved ${dx.toFixed(2)}px in ${dt.toFixed(1)}ms`
        ).toBeLessThan(maxSpeed * dt + tolerance)
    }
}

/**
 * For animations that change speed, no frame's movement differs from the
 * one before by more than limit (px per ms).
 */
function expectSmooth(frames: Frame[], limit: number) {
    for (let i = 2; i < frames.length; i++) {
        const speed = (a: Frame, b: Frame) =>
            (b.x - a.x) / (timeOf(b) - timeOf(a))
        const before = speed(frames[i - 2], frames[i - 1])
        const after = speed(frames[i - 1], frames[i])
        expect(
            Math.abs(after - before),
            `frame ${i}: ${before.toFixed(3)} then ${after.toFixed(3)}px/ms`
        ).toBeLessThan(limit)
    }
}

/**
 * The frames that have `from` accelerated transforms, then `to`.
 */
function expectHandoff(frames: Frame[], from: number, to: number) {
    const index = frames.findIndex((frame) => frame.count === to)
    expect(index, "no hand-off recorded").toBeGreaterThan(2)
    expect(
        frames.slice(0, index).every((f) => f.count === from),
        `frames before the hand-off: ${frames
            .slice(0, index)
            .map((f) => f.count)
            .join("")}`
    ).toBe(true)
    return index
}

test.describe("pooled transforms hand-off", () => {
    test.use({ viewport: { width: 1000, height: 500 } })

    test.beforeEach(async ({ page }) => load(page))

    test("runs on the compositor and finishes in place", async ({ page }) => {
        const { frames, style } = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            animate(element, { x: 300 }, { duration: 1, ease: "linear" })
            await window.wait(100)
            const frames = await window.recordFrames(element, 1100)
            return {
                frames,
                style: {
                    transform: element.style.transform,
                    translate: (element.style as any).translate,
                },
            }
        })

        const end = frames.findIndex((frame) => frame.x >= 300)
        expect(end).toBeGreaterThan(5)
        expect(frames.slice(0, end).every((f) => f.count === 1)).toBe(true)
        expectSteady(frames, 0.3, "x", 1, end)

        // Finished: back on the main thread, at the target, without a jump.
        expect(frames.slice(end).every((f) => f.x === 300)).toBe(true)
        expect(frames[frames.length - 1].count).toBe(0)
        expect(style.transform).toBe("translateX(300px)")
        expect(style.translate).toBe("")
    })

    test("an interrupting animation starts where the first one was", async ({
        page,
    }) => {
        const frames = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            animate(element, { x: 600 }, { duration: 3, ease: "linear" })
            await window.wait(300)
            const recording = window.recordFrames(element, 1000)
            await window.wait(300)
            animate(element, { x: 0 }, { duration: 1, ease: "linear" })
            return recording
        })

        // Both animations are accelerated.
        expect(frames.every((f) => f.count === 1)).toBe(true)
        expectContinuous(frames, 0.2)

        const peak = frames.reduce((a, b) => (b.x > a.x ? b : a))
        expect(peak.x).toBeGreaterThan(100)
        expect(frames[frames.length - 1].x).toBeLessThan(peak.x - 50)
    })

    test("to the main thread when another value writes the same property", async ({
        page,
    }) => {
        const frames = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            animate(element, { x: 600 }, { duration: 3, ease: "linear" })
            await window.wait(300)
            const recording = window.recordFrames(element, 1000)
            await window.wait(300)
            animate(
                element,
                { y: 100 },
                { duration: 0.5, ease: "linear", onUpdate: () => {} }
            )
            return recording
        })

        const handoff = expectHandoff(frames, 1, 0)
        expect(handoff).toBeLessThan(frames.length - 5)
        // 600px over 3s, before and after the hand-off.
        expectSteady(frames, 0.2)
        // y animated on the main thread alongside.
        expect(frames[frames.length - 1].y).toBeCloseTo(100, 0)
    })

    test("to the main thread when an inertia animation joins", async ({
        page,
    }) => {
        const frames = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            animate(element, { x: 600 }, { duration: 3, ease: "linear" })
            await window.wait(300)
            const recording = window.recordFrames(element, 1000)
            await window.wait(300)
            animate(
                element,
                { y: [0, 100] },
                { type: "inertia", velocity: 400, timeConstant: 100 }
            )
            return recording
        })

        expectHandoff(frames, 1, 0)
        expectSteady(frames, 0.2)
    })

    test("a main-thread value on another property leaves it on the compositor", async ({
        page,
    }) => {
        const frames = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            animate(element, { x: 600 }, { duration: 3, ease: "linear" })
            await window.wait(300)
            const recording = window.recordFrames(element, 800)
            await window.wait(200)
            animate(
                element,
                { rotate: 90 },
                { duration: 0.4, ease: "linear", onUpdate: () => {} }
            )
            return recording
        })

        expect(frames.every((f) => f.count === 1)).toBe(true)
        expectSteady(frames, 0.2)
        expect(frames[frames.length - 1].rotate).toBeCloseTo(90, 0)
    })

    test("to the main thread when a value baked into the property changes", async ({
        page,
    }) => {
        const frames = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate, motionValue, styleEffect } = window.Motion
            const y = motionValue(20)
            styleEffect(element, { y })
            animate(element, { x: 600 }, { duration: 3, ease: "linear" })
            await window.wait(300)
            const recording = window.recordFrames(element, 1000)
            await window.wait(300)
            y.set(50)
            return recording
        })

        const handoff = expectHandoff(frames, 1, 0)
        expectSteady(frames, 0.2)
        expect(frames[handoff - 1].y).toBe(20)
        expect(frames[handoff].y).toBe(50)
    })

    test("to the main thread mid-spring keeps velocity", async ({ page }) => {
        const frames = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            animate(
                element,
                { x: 300 },
                { type: "spring", stiffness: 50, damping: 15 }
            )
            await window.wait(100)
            const recording = window.recordFrames(element, 800)
            await window.wait(250)
            animate(
                element,
                { y: [0, 100] },
                { type: "inertia", velocity: 400, timeConstant: 100 }
            )
            return recording
        })

        expectHandoff(frames, 1, 0)
        /**
         * The spring accelerates at most 50 * 300 px/s², 0.015px/ms², so
         * speed changes by under 0.5px/ms between frames.
         */
        expectSmooth(frames, 0.5)
        const moving = frames.filter((f, i) => i && f.x > frames[i - 1].x)
        expect(moving.length).toBe(frames.length - 1)
    })

    test("an interrupted value hands its velocity to a spring", async ({
        page,
    }) => {
        const frames = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            animate(element, { x: 600 }, { duration: 2, ease: "linear" })
            await window.wait(300)
            const recording = window.recordFrames(element, 800)
            await window.wait(200)
            animate(
                element,
                { x: 0 },
                { type: "spring", stiffness: 100, damping: 10 }
            )
            return recording
        })

        /**
         * Moving at 300px/s when the spring takes over, the element keeps
         * moving away from its new target before turning back. The spring
         * accelerates at most 100 * 200px/s², 0.02px/ms², so speed changes
         * by under 0.4px/ms between frames.
         */
        expectSmooth(frames, 0.4)
        const takeover = frames.findIndex((f, i) => i && f.x < frames[i - 1].x)
        expect(takeover).toBeGreaterThan(3)
        const peak = frames[takeover - 1]
        expect(peak.x).toBeGreaterThan(frames[3].x + 10)
        expect(frames[frames.length - 1].x).toBeLessThan(peak.x - 20)
    })

    test("seek, pause, play and speed act on the compositor animation", async ({
        page,
    }) => {
        const { seeked, paused, resumed } = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            const animation = animate(
                element,
                { x: 600 },
                { duration: 3, ease: "linear" }
            )
            await window.wait(200)
            animation.time = 1
            const seeked = await window.recordFrames(element, 300)
            animation.pause()
            const paused = await window.recordFrames(element, 200)
            animation.play()
            animation.speed = 2
            const resumed = await window.recordFrames(element, 300)
            return { seeked, paused, resumed }
        })

        for (const frames of [seeked, paused, resumed]) {
            expect(frames.every((f) => f.count === 1)).toBe(true)
        }
        expect(seeked[1].x).toBeGreaterThan(200)
        expect(seeked[1].x).toBeLessThan(230)
        expectSteady(seeked, 0.2)
        expect(paused.every((f) => f.x === paused[0].x)).toBe(true)
        expectSteady(resumed, 0.4)
    })

    test("stop() leaves the element where it is", async ({ page }) => {
        const { frames, transform } = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            const animation = animate(
                element,
                { x: 600 },
                { duration: 3, ease: "linear" }
            )
            await window.wait(300)
            const recording = window.recordFrames(element, 600)
            await window.wait(200)
            animation.stop()
            const frames = await recording
            return { frames, transform: element.style.transform }
        })

        const stopped = expectHandoff(frames, 1, 0)
        expectSteady(frames, 0.2, "x", 1, stopped)
        expect(frames.slice(stopped).every((f) => f.x === frames[stopped].x))
        expect(Math.abs(frames[stopped].x - frames[stopped - 1].x)).toBeLessThan(
            6
        )
        expect(transform).toMatch(/^translateX\(\d+(\.\d+)?px\)$/)
    })

    test("transforms without an individual property stay on the main thread", async ({
        page,
    }) => {
        const { frames, transform } = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            animate(
                element,
                { scaleX: 2, rotate: 90, x: 100 },
                { duration: 0.5, ease: "linear" }
            )
            const frames = await window.recordFrames(element, 700)
            return { frames, transform: element.style.transform }
        })

        expect(frames.every((f) => f.count === 0)).toBe(true)
        const last = frames[frames.length - 1]
        expect(last.rotate).toBeCloseTo(90, 0)
        expect(last.x).toBeCloseTo(100, 0)
        expect(transform).toBe("translateX(100px) scaleX(2) rotate(90deg)")
    })

    test("an interrupted opacity animation carries on from its value", async ({
        page,
    }) => {
        const frames = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            animate(element, { opacity: 0 }, { duration: 2, ease: "linear" })
            await window.wait(300)
            const recording = window.recordFrames(element, 1000)
            await window.wait(200)
            animate(element, { opacity: 1 }, { duration: 0.5, ease: "linear" })
            return recording
        })

        for (let i = 1; i < frames.length; i++) {
            expect(
                Math.abs(frames[i].opacity - frames[i - 1].opacity),
                `frame ${i}`
            ).toBeLessThan(0.05)
        }
        const low = frames.reduce((a, b) => (b.opacity < a.opacity ? b : a))
        expect(low.opacity).toBeLessThan(0.8)
        expect(frames[frames.length - 1].opacity).toBeGreaterThan(
            low.opacity + 0.2
        )
    })
})
