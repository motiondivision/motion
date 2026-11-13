import { expect, test } from "@playwright/test"

/**
 * A motion component's animations start as it mounts. When its first frame
 * is late, the animations WAAPI runs and the clock they share must agree
 * on when they started. If they don't, the component reaches its target,
 * jumps back and plays the end of its animation again.
 */
test("a motion component animates once when its first frame is late", async ({
    page,
}) => {
    await page.goto("?test=independent-transforms-late-frame")
    await page.waitForSelector("#box")
    await page.waitForTimeout(1000)

    const frames: number[] = await page.evaluate(() => (window as any).frames)

    expect(frames.length).toBeGreaterThan(10)
    for (let i = 1; i < frames.length; i++) {
        expect(frames[i], `frame ${i}`).toBeGreaterThanOrEqual(
            frames[i - 1] - 0.5
        )
    }
    expect(frames[frames.length - 1]).toBe(100)
})
