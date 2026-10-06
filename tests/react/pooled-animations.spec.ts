import { expect, test } from "@playwright/test"

/**
 * Values animating on the compositor can be read, and taken over by
 * gestures, from exactly where they are.
 */

interface Frame {
    t: number
    ts: number
    left: number
    isDown: boolean
    count: number
}

/**
 * Rounding and timing differences allow up to this many px of difference
 * per frame.
 */
const tolerance = 2.5

const timeOf = (frame: Frame) => (frame.count ? frame.t : frame.ts)

test.describe("pooled animations in React", () => {
    test.use({ viewport: { width: 1000, height: 500 } })

    test.beforeEach(async ({ page }) => {
        await page.goto("?test=pooled-animations")
        await page.waitForSelector("#drag")
        await page.waitForTimeout(300)
    })

    test("a value on the compositor reads back where it is", async ({
        page,
    }) => {
        for (let i = 0; i < 3; i++) {
            const { value, left, count } = await page.evaluate(() =>
                (window as any).readBack()
            )
            expect(count).toBe(1)
            expect(value).toBeGreaterThan(20)
            /**
             * The compositor may be a frame ahead of the main thread:
             * 0.2px/ms over 17ms.
             */
            expect(Math.abs(value - left)).toBeLessThan(0.2 * 17 + tolerance)
            await page.waitForTimeout(200)
        }
    })

    test("dragging takes over from where the compositor had it", async ({
        page,
    }) => {
        const recording = page.evaluate(() =>
            (window as any).recordFrames("drag", 1000)
        )
        await page.waitForTimeout(300)

        const { x, y, width, height } = (await page
            .locator("#drag")
            .boundingBox())!
        const startX = x + width / 2
        const startY = y + height / 2
        await page.mouse.move(startX, startY)
        await page.mouse.down()
        for (let i = 1; i <= 10; i++) {
            await page.mouse.move(startX + i * 5, startY)
            await page.waitForTimeout(20)
        }
        await page.waitForTimeout(200)
        const frames = (await recording) as Frame[]
        await page.mouse.up()

        const down = frames.findIndex((f) => f.isDown)
        expect(down).toBeGreaterThan(2)
        expect(frames.slice(0, down).every((f) => f.count === 1)).toBe(true)

        /**
         * No frame jumps by more than the animation (0.2px/ms) or the
         * pointer (5px per move) could move it.
         */
        for (let i = 1; i < frames.length; i++) {
            const dt = timeOf(frames[i]) - timeOf(frames[i - 1])
            const dx = frames[i].left - frames[i - 1].left
            expect(
                Math.abs(dx),
                `frame ${i}: moved ${dx.toFixed(2)}px in ${dt.toFixed(1)}ms`
            ).toBeLessThan(0.2 * dt + 15 + tolerance)
        }

        // The element followed the pointer from where it was.
        const moved = frames[frames.length - 1].left - frames[down - 1].left
        expect(moved).toBeGreaterThan(50 - 0.2 * 40 - tolerance)
        expect(moved).toBeLessThan(50 + 0.2 * 40 + tolerance)
    })
})
