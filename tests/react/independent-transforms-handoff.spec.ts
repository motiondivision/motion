import { expect, test } from "@playwright/test"

/**
 * When projection measures an element, its transforms move from the
 * compositor to the main thread. The element must carry on from exactly
 * where it was, at the same speed: no jump, no stalled frame.
 */

interface Frame {
    t: number
    ts: number
    left: number
    top: number
    count: number
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

function expectSteady(frames: Frame[], speed: number) {
    for (let i = 1; i < frames.length; i++) {
        const dt = timeOf(frames[i]) - timeOf(frames[i - 1])
        const dx = frames[i].left - frames[i - 1].left
        expect(
            Math.abs(dx - speed * dt),
            `frame ${i}: moved ${dx.toFixed(2)}px in ${dt.toFixed(1)}ms`
        ).toBeLessThan(tolerance)
    }
}

function expectHandoff(frames: Frame[]) {
    const index = frames.findIndex((frame) => frame.count === 0)
    expect(index, "no hand-off recorded").toBeGreaterThan(2)
    expect(frames.slice(0, index).every((f) => f.count === 1)).toBe(true)
    expect(frames.slice(index).every((f) => f.count === 0)).toBe(true)
}

test.describe("independent transforms hand-off to layout", () => {
    test.use({ viewport: { width: 1000, height: 500 } })

    test.beforeEach(async ({ page }) => {
        await page.goto("?test=independent-transforms-handoff")
        await page.waitForSelector("#shift")
        await page.waitForTimeout(300)
    })

    test("a render of a layout component", async ({ page }) => {
        const frames: Frame[] = await page.evaluate(async () => {
            const recording = (window as any).recordFrames("rerender", 800)
            await new Promise((resolve) => setTimeout(resolve, 300))
            ;(window as any).rerender()
            return recording
        })

        expectHandoff(frames)
        // 600px over 3s.
        expectSteady(frames, 0.2)
    })

    test("a layout animation that moves the element", async ({ page }) => {
        const frames: Frame[] = await page.evaluate(async () => {
            const recording = (window as any).recordFrames("shift", 900)
            await new Promise((resolve) => setTimeout(resolve, 300))
            ;(window as any).grow()
            return recording
        })

        expectHandoff(frames)
        // x carries on while the layout animation moves it down.
        expectSteady(frames, 0.2)
        const last = frames[frames.length - 1]
        expect(last.top - frames[0].top).toBeCloseTo(50, 0)
    })
})
