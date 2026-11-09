import { expect, test } from "@playwright/test"

/**
 * A 40px white box animates x 0 to 280 over 1s, linear, on a dark
 * background. A counter square is set blue or red on Motion's frameloop,
 * by whether the animation's frame is even or odd.
 */
test.beforeEach(async ({ page }) => {
    await page.goto("canvas/export.html")
    await page.waitForFunction(() => (window as any).ready)
})

test("renderVideo() captures every frame at its time", async ({ page }) => {
    const { count, frames } = await page.evaluate(() =>
        (window as any).exportFrames()
    )

    expect(count).toBe(30)
    expect(frames).toHaveLength(30)

    frames.forEach((frame: any, i: number) => {
        expect(frame.timestamp).toBeCloseTo(i / 30, 10)
        expect(frame.duration).toBeCloseTo(1 / 30, 10)
        // Drawn where the animation is at this frame's time
        expect(Math.abs(frame.left - (280 * i) / 30)).toBeLessThanOrEqual(1)
        // DOM changes made on the frameloop for this frame are in it
        expect(frame.frameIndex).toBe(i)
        expect(frame.counter).toEqual(
            i % 2 ? [255, 0, 0, 255] : [0, 0, 255, 255]
        )
    })
})

test("renderVideo() feeds a mediabunny encoder", async ({ page }) => {
    const result = await page.evaluate(() => (window as any).exportVideo())

    expect(result.count).toBe(30)
    expect(result.bytes).toBeGreaterThan(0)
    expect(result.timestamps).toHaveLength(30)
    result.timestamps.forEach((timestamp: number, i: number) =>
        expect(timestamp).toBeCloseTo(i / 30, 3)
    )
})
