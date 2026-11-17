import { expect, test } from "@playwright/test"

/**
 * The values of one animate() call share a clock. These are options and
 * state of the call that each value's own animation used to keep.
 */
test.describe("animate() with shared playback", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("animate/animate-shared-playback.html")
    })

    test("startTime starts each kind of value from that time", async ({
        page,
    }) => {
        const { startTimes, startTime, x, opacity, width } =
            await page.evaluate(async () => {
                const { started, startTime } = window as any
                await new Promise((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(resolve))
                )
                const style = (id: string) =>
                    getComputedStyle(document.getElementById(id)!)
                return {
                    startTime,
                    startTimes: Object.keys(started).map(
                        (key) => started[key].startTime
                    ),
                    x: new DOMMatrixReadOnly(style("transform").transform).m41,
                    opacity: parseFloat(style("waapi").opacity),
                    width: parseFloat(style("js").width),
                }
            })

        expect(startTimes).toEqual([startTime, startTime, startTime])

        // Half a second into one second, when the page loaded.
        expect(x).toBeGreaterThan(50)
        expect(opacity).toBeGreaterThan(0.5)
        expect(width).toBeGreaterThan(150)
    })

    test("is finished once its other values finish after one is interrupted", async ({
        page,
    }) => {
        await page.waitForTimeout(600)
        expect(
            await page.evaluate(() => (window as any).interrupted.state)
        ).toBe("finished")
    })

    test("leaves nothing on the browser's animation of a value", async ({
        page,
    }) => {
        await page.waitForFunction(() => (window as any).left.done)
        const { left, held } = await page.evaluate(() => ({
            left: (window as any).left,
            held: (window as any).held,
        }))

        // Each value was on an animation of the browser's.
        expect(held).toEqual([])

        const nothing = { onfinish: false, references: [] }
        expect(left.finished).toEqual(nothing)
        expect(left.cancelled).toEqual(nothing)
        expect(left.stopped).toEqual(nothing)
    })
})
