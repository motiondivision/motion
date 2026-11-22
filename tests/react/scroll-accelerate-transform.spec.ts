import { expect, test } from "@playwright/test"

/**
 * Transforms that follow useScroll through useTransform, like a parallax
 * y, play on a native ScrollTimeline with the element's other transforms,
 * so scrolling writes no styles.
 */
test.describe("useScroll transforms on a scroll timeline", () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 800, height: 600 })
        await page.goto("?test=scroll-accelerate-transform")
        await page.waitForSelector("#y")
        await page.waitForTimeout(300)
    })

    const transformTimelines = (page: any, id: string) =>
        page.locator(id).evaluate((el: Element) =>
            el
                .getAnimations()
                .filter((a: any) => "transform" in a.effect.getKeyframes()[0])
                .map((a: any) => a.timeline?.constructor.name)
        )

    test("a lone y plays on a ScrollTimeline", async ({ page }) => {
        expect(await transformTimelines(page, "#y")).toEqual(["ScrollTimeline"])
    })

    test("transforms of one element share one animation", async ({ page }) => {
        expect(await transformTimelines(page, "#combined")).toEqual([
            "ScrollTimeline",
        ])
    })

    test("scrolling writes no styles and moves the element", async ({
        page,
    }) => {
        await page.evaluate(() => {
            ;(window as any).writes = 0
            new MutationObserver(
                (m) => ((window as any).writes += m.length)
            ).observe(document.getElementById("y")!, {
                attributes: true,
                attributeFilter: ["style"],
            })
        })

        for (let i = 1; i <= 10; i++) {
            await page.evaluate((top) => window.scrollTo(0, top), i * 120)
            await page.waitForTimeout(50)
        }
        await page.waitForTimeout(200)

        expect(await page.evaluate(() => (window as any).writes)).toBe(0)

        const maxScroll = await page.evaluate(
            () => document.documentElement.scrollHeight - innerHeight
        )
        const y = await page
            .locator("#y")
            .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).f)
        expect(y).toBeCloseTo((Math.min(1200, maxScroll) / maxScroll) * 200, 0)

        const combined = await page
            .locator("#combined")
            .evaluate((el) => getComputedStyle(el).transform)
        expect(combined).not.toBe("none")
    })
})
