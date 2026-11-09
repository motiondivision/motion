import { expect, Page, test } from "@playwright/test"

/**
 * A style driven by useScroll() through useTransform() runs as a WAAPI
 * animation on a native scroll timeline.
 */

const describe = (page: Page) =>
    page.evaluate(() => {
        const element = document.getElementById("direct")!
        return element.getAnimations().map((animation) => {
            const effect = animation.effect as KeyframeEffect
            const { duration, fill, easing, iterations, direction, delay } =
                effect.getTiming()
            return {
                isScroll:
                    animation.timeline instanceof
                    (window as any).ScrollTimeline,
                hasFinishHandler: animation.onfinish !== null,
                playState: animation.playState,
                timing: {
                    duration,
                    fill,
                    easing,
                    iterations,
                    direction,
                    delay,
                },
                keyframes: effect
                    .getKeyframes()
                    .map(({ offset, opacity, easing }) => ({
                        offset,
                        opacity,
                        easing,
                    })),
            }
        })
    })

const scrollTo = async (page: Page, progress: number) => {
    await page.evaluate((progress) => {
        const { scrollHeight, clientHeight } = document.documentElement
        window.scrollTo(0, (scrollHeight - clientHeight) * progress)
    }, progress)
    await page.waitForTimeout(100)
}

const opacity = (page: Page, id: string) =>
    page.evaluate(
        (id) =>
            parseFloat(getComputedStyle(document.getElementById(id)!).opacity),
        id
    )

test.describe("useScroll acceleration", () => {
    test.use({ viewport: { width: 500, height: 500 } })

    test.beforeEach(async ({ page }) => {
        await page.goto("?test=scroll-accelerate")
        await page.waitForSelector("#direct")
        await page.waitForTimeout(200)
    })

    test("runs one WAAPI animation on a scroll timeline", async ({ page }) => {
        const animations = await describe(page)
        expect(animations).toEqual([
            {
                isScroll: true,
                hasFinishHandler: false,
                playState: "running",
                timing: {
                    delay: 0,
                    direction: "normal",
                    duration: 1000,
                    easing: expect.stringMatching(
                        /^linear\(0 0%, 0\.0101 .* 1 100%\)$/
                    ),
                    fill: "both",
                    iterations: 1,
                },
                keyframes: [
                    { offset: 0, opacity: "1", easing: "linear" },
                    { offset: 0, opacity: "1", easing: "linear" },
                    { offset: 0.5, opacity: "0.5", easing: "linear" },
                    { offset: 1, opacity: "0", easing: "linear" },
                    { offset: 1, opacity: "0", easing: "linear" },
                ],
            },
        ])
    })

    test("follows the scroll position", async ({ page }) => {
        expect(await opacity(page, "direct")).toBeCloseTo(1, 2)

        await scrollTo(page, 0.25)
        expect(await opacity(page, "direct")).toBeCloseTo(0.75, 2)

        await scrollTo(page, 0.5)
        expect(await opacity(page, "direct")).toBeCloseTo(0.5, 2)

        await scrollTo(page, 1)
        expect(await opacity(page, "direct")).toBeCloseTo(0, 2)

        await scrollTo(page, 0.5)
        expect(await opacity(page, "direct")).toBeCloseTo(0.5, 2)
    })

    test("leaves chained and non-composited values to JS", async ({ page }) => {
        expect(
            await page.evaluate(
                () => document.getElementById("chained")!.getAnimations().length
            )
        ).toBe(0)

        await scrollTo(page, 1)
        expect(await opacity(page, "chained")).toBeCloseTo(1, 2)
        expect(
            await page.evaluate(
                () =>
                    getComputedStyle(document.getElementById("direct")!)
                        .backgroundColor
            )
        ).toBe("rgb(0, 0, 255)")
    })
})
