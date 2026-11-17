import { expect, Page, test } from "@playwright/test"

/**
 * repeatDelay holds a value at the end of each iteration before the next
 * starts. A reversed iteration starts back straight after the hold, and
 * the animation ends with its last iteration, not after another delay.
 * Transforms play on the compositor, so this is how the WAAPI animation
 * is built.
 */

interface Result {
    frames: { t: number; x: number }[]
    finishedAt?: number
}

const result = async (page: Page, name: string) => {
    await page.waitForFunction(
        (name) => (window as any).results?.[name].finishedAt !== undefined,
        name
    )
    return page.evaluate(
        (name) => (window as any).results[name] as Result,
        name
    )
}

/**
 * x at the frame nearest a time.
 */
const at = ({ frames }: Result, time: number) =>
    frames.reduce((nearest, frame) =>
        Math.abs(frame.t - time) < Math.abs(nearest.t - time) ? frame : nearest
    ).x

test.describe("repeatDelay on the compositor", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("animate/animate-repeat-delay.html")
    })

    test("a reversed repeat holds once at the far end, then returns", async ({
        page,
    }) => {
        const reverse = await result(page, "reverse")

        // Out for 400ms, held for 400ms.
        expect(at(reverse, 200)).toBeGreaterThan(50)
        expect(at(reverse, 200)).toBeLessThan(150)
        expect(at(reverse, 600)).toBeCloseTo(200, 0)

        // On its way back for 400ms.
        expect(at(reverse, 1000)).toBeGreaterThan(50)
        expect(at(reverse, 1000)).toBeLessThan(150)

        expect(at(reverse, 1400)).toBeCloseTo(0, 0)
        expect(reverse.finishedAt).toBeGreaterThan(1100)
        expect(reverse.finishedAt).toBeLessThan(1400)
    })

    test("a looped repeat ends with its last iteration", async ({ page }) => {
        const loop = await result(page, "loop")

        expect(at(loop, 600)).toBeCloseTo(200, 0)
        expect(at(loop, 1000)).toBeGreaterThan(50)
        expect(at(loop, 1000)).toBeLessThan(150)
        expect(at(loop, 1400)).toBeCloseTo(200, 0)
        expect(loop.finishedAt).toBeGreaterThan(1100)
        expect(loop.finishedAt).toBeLessThan(1400)
    })

    test("without a repeat there's no delay", async ({ page }) => {
        const once = await result(page, "once")

        expect(at(once, 600)).toBeCloseTo(200, 0)
        expect(once.finishedAt).toBeGreaterThan(350)
        expect(once.finishedAt).toBeLessThan(600)
    })
})
