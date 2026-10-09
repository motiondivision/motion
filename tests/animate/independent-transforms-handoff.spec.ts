import { expect, Page, test } from "@playwright/test"

/**
 * When an element's transforms move between the compositor (one WAAPI
 * animation) and the main thread (JS animations), the element must carry
 * on from exactly where it was, at the same speed: no jump, no stalled
 * frame. Each test records the element every frame across the hand-off and
 * checks every frame's movement.
 */

interface Frame {
    t: number
    ts: number
    x: number
    y: number
    scale: number
    rotate: number
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
const timeOf = (frame: Frame) => (frame.count ? frame.t : frame.ts)

/**
 * Every frame moves at speed (px per ms), within tolerance.
 */
function expectSteady(frames: Frame[], speed: number, key: "x" | "y" = "x") {
    for (let i = 1; i < frames.length; i++) {
        const dt = timeOf(frames[i]) - timeOf(frames[i - 1])
        const dx = frames[i][key] - frames[i - 1][key]
        expect(
            Math.abs(dx - speed * dt),
            `frame ${i}: moved ${dx.toFixed(2)}px in ${dt.toFixed(1)}ms`
        ).toBeLessThan(tolerance)
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
 * The frames that are on the compositor, then on the main thread.
 */
function expectHandoff(frames: Frame[], from: number, to: number) {
    const index = frames.findIndex((frame) => frame.count === to)
    expect(index, "no hand-off recorded").toBeGreaterThan(2)
    expect(frames.slice(0, index).every((f) => f.count === from)).toBe(true)
    return index
}

test.describe("independent transforms hand-off", () => {
    test.use({ viewport: { width: 1000, height: 500 } })

    test.beforeEach(async ({ page }) => load(page))

    test("to the main thread when an inertia animation joins, and back", async ({
        page,
    }) => {
        const frames = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            animate(element, { x: 600 }, { duration: 3, ease: "linear" })
            await window.wait(300)
            const recording = window.recordFrames(element, 2200)
            await window.wait(300)
            animate(
                element,
                { y: [0, 100] },
                { type: "inertia", velocity: 400, timeConstant: 100 }
            )
            return recording
        })

        const toJS = expectHandoff(frames, 1, 0)
        const toWAAPI = expectHandoff(frames.slice(toJS), 0, 1) + toJS
        expect(toWAAPI).toBeLessThan(frames.length - 2)

        // 600px over 3s.
        expectSteady(frames, 0.2)
    })

    test("to the main thread when another value is written every frame", async ({
        page,
    }) => {
        const frames = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate, frame, cancelFrame, motionValue, styleEffect } =
                window.Motion
            const rotate = motionValue(0)
            styleEffect(element, { rotate })
            animate(element, { x: 600 }, { duration: 3, ease: "linear" })
            await window.wait(300)
            const recording = window.recordFrames(element, 1000)
            await window.wait(300)
            const spin = () => rotate.set(rotate.get() + 1)
            frame.update(spin, true)
            await window.wait(300)
            cancelFrame(spin)
            return recording
        })

        expectHandoff(frames, 1, 0)
        expectSteady(frames, 0.2)
    })

    test("to the main thread when seeks keep missing the WAAPI animation", async ({
        page,
    }) => {
        const frames = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            animate(element, { x: 600 }, { duration: 3, ease: "linear" })
            const y = animate(
                element,
                { y: [0, 100] },
                { duration: 3, ease: "linear" }
            )
            await window.wait(300)
            const recording = window.recordFrames(element, 1000)
            await window.wait(300)
            // Seek y back to the start, twice, which the WAAPI animation
            // (built from when y was last updated) can't follow.
            y.time = 0
            await window.wait(20)
            y.time = 0
            return recording
        })

        expectHandoff(frames, 1, 0)
        // x is unaffected by seeking y.
        expectSteady(frames, 0.2)
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

    test("speed changes stay on the compositor without a jump", async ({
        page,
    }) => {
        const frames = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            const animation = animate(
                element,
                { x: 600 },
                { duration: 3, ease: "linear" }
            )
            await window.wait(300)
            const recording = window.recordFrames(element, 800)
            await window.wait(400)
            animation.speed = 2
            return recording
        })

        expect(frames.every((f) => f.count === 1)).toBe(true)
        const changed = frames.findIndex(
            (f, i) =>
                i && (f.x - frames[i - 1].x) / (f.t - frames[i - 1].t) > 0.3
        )
        expect(changed).toBeGreaterThan(2)
        expectSteady(frames.slice(0, changed), 0.2)
        expectSteady(frames.slice(changed), 0.4)
        // The frame it changed in moved between the two speeds.
        const dt = frames[changed].t - frames[changed - 1].t
        const dx = frames[changed].x - frames[changed - 1].x
        expect(dx).toBeGreaterThan(0.2 * dt - tolerance)
        expect(dx).toBeLessThan(0.4 * dt + tolerance)
    })

    test("pause() and play() stay on the compositor without a jump", async ({
        page,
    }) => {
        const frames = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            const animation = animate(
                element,
                { x: 600 },
                { duration: 3, ease: "linear" }
            )
            await window.wait(300)
            const recording = window.recordFrames(element, 1000)
            await window.wait(300)
            animation.pause()
            await window.wait(300)
            animation.play()
            return recording
        })

        expect(frames.every((f) => f.count === 1)).toBe(true)
        const paused = frames.findIndex(
            (f, i) => i && Math.abs(f.x - frames[i - 1].x) < 0.01
        )
        const resumed = frames.findIndex(
            (f, i) => i > paused && f.x - frames[i - 1].x > 0.01
        )
        expect(paused).toBeGreaterThan(2)
        expect(resumed).toBeGreaterThan(paused + 5)

        /**
         * pause() and play() happen between frames, so the frames they
         * happen in move part of a frame's distance.
         */
        const expectPartial = (i: number) => {
            const dx = frames[i].x - frames[i - 1].x
            expect(dx).toBeGreaterThanOrEqual(-0.01)
            expect(dx).toBeLessThan(
                0.2 * (frames[i].t - frames[i - 1].t) + tolerance
            )
        }
        expectSteady(frames.slice(0, paused - 1), 0.2)
        expectPartial(paused - 1)
        expectSteady(frames.slice(paused - 1, resumed), 0)
        expectPartial(resumed)
        expectSteady(frames.slice(resumed), 0.2)
    })
})
