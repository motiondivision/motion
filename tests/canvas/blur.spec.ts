import { expect, test } from "@playwright/test"

/**
 * Three 60px squares. #moving and #unblurred move at 1200px/s, 20px a
 * frame. The layer's shutter is fully open; #unblurred turns blur off.
 * #still never moves. Each step renders one frame on Motion's manual
 * clock and reads it in its own paint.
 */
test("blurs a moving element and leaves still ones sharp", async ({ page }) => {
    await page.goto("canvas/blur.html")
    await page.waitForFunction(() => (window as any).ready)

    const frames = await page.evaluate(async () => {
        const w = window as any
        const results = [await w.stepTo(0)]
        w.start()
        for (let frame = 1; frame <= 8; frame++) {
            results.push(await w.stepTo((frame * 1000) / 60))
        }
        return results
    })

    const [atRest, , , , , moving] = frames

    // Before anything moves, every edge is sharp
    expect(atRest.moving).toBe(0)
    expect(atRest.still).toBe(0)

    // Mid-move, both edges of #moving fade over about a frame's travel
    expect(moving.moving).toBeGreaterThanOrEqual(30)
    // Same speed, blur off: sharp
    expect(moving.unblurred).toBe(0)
    // Never moved: sharp
    expect(moving.still).toBe(0)

    /**
     * Averaging 20+ faint samples in 8 bits tints colours. Where the
     * square covers every sample, its colour must be unchanged.
     */
    expect(moving.solid).not.toBeNull()
    const [r, g, b, a] = moving.solid
    expect(Math.abs(r - 240)).toBeLessThanOrEqual(2)
    expect(Math.abs(g - 200)).toBeLessThanOrEqual(2)
    expect(Math.abs(b - 20)).toBeLessThanOrEqual(2)
    expect(a).toBe(255)
})

test("an element that has come to rest is drawn sharp", async ({ page }) => {
    await page.goto("canvas/blur.html")
    await page.waitForFunction(() => (window as any).ready)

    const { last, rest, again } = await page.evaluate(async () => {
        const w = window as any
        await w.stepTo(0)
        w.start()
        let last
        for (let frame = 1; frame <= 15; frame++) {
            last = await w.stepTo((frame * 1000) / 60)
        }
        // The animation ends at 250ms. Its last move is still blurred,
        // then the next frame draws it once, at rest.
        const rest = await w.stepTo(300)
        const again = await w.stepTo(400)
        return { last, rest, again }
    })

    expect(last.moving).toBeGreaterThan(0)
    expect(rest.moving).toBe(0)
    expect(rest.movingRight).toBe(360)
    expect(again.moving).toBe(0)
})
