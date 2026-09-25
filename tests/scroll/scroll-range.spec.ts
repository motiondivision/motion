import { expect, Page, test } from "@playwright/test"

/**
 * scroll() rangeStart/rangeEnd map the range onto the animation and hold the
 * first keyframe before it and the last keyframe after it.
 *
 * With a 1000px viewport the page scrolls 4000px, so the page range 10%–30%
 * is 400–1200px. #target is 500px tall at top 2500px, so its cover range runs
 * from 1500px to 3000px and the target range 0%–50% is 1500–2250px.
 *
 * Where ScrollTimeline is supported the opacity boxes run natively and the
 * x boxes via the JS observe path, so the two are checked against each other.
 */
type Box = [id: string, value: "opacity" | "x"]

const pageBoxes: Box[] = [
    ["box", "opacity"],
    ["js-box", "x"],
]

const targetBoxes: Box[] = [
    ["target-box", "opacity"],
    ["target-js-box", "x"],
]

/**
 * Playwright's WebKit exposes ViewTimeline but its currentTime doesn't follow
 * scroll (also on main, without a range). Target values, JS ones included,
 * follow that timeline where it exists.
 */
const skipBrokenViewTimeline = (browserName: string) =>
    test.skip(browserName === "webkit", "WebKit's ViewTimeline is frozen")

const readProgress = (page: Page, [id, value]: Box) =>
    page.evaluate(
        ([elementId, isOpacity]) => {
            const { opacity, transform } = getComputedStyle(
                document.getElementById(elementId as string)!
            )
            return isOpacity
                ? parseFloat(opacity)
                : transform === "none"
                ? 0
                : new DOMMatrix(transform).m41 / 100
        },
        [id, value === "opacity"]
    )

async function scrollTo(page: Page, y: number) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y)
    await page.waitForTimeout(100)
}

async function scrollThrough(
    page: Page,
    boxes: Box[],
    positions: Array<[number, number]>
) {
    for (const [y, progress] of positions) {
        await scrollTo(page, y)
        for (const box of boxes) {
            expect(
                await readProgress(page, box),
                `${box[0]} at ${y}`
            ).toBeCloseTo(progress, 1)
        }
    }
}

test.describe("scroll() rangeStart/rangeEnd", () => {
    test.use({ viewport: { width: 1000, height: 1000 } })

    test.beforeEach(async ({ page }) => {
        await page.goto("scroll/scroll-range.html")
        await page.waitForTimeout(100)
    })

    test("WAAPI values run on native timelines where supported", async ({
        page,
    }) => {
        const timelines = await page.evaluate(() => {
            const win = window as any
            if (!win.ScrollTimeline) return null

            const timeline = (id: string) =>
                (document.getElementById(id)!.getAnimations()[0] as any)
                    .timeline

            return [
                timeline("box") instanceof win.ScrollTimeline,
                timeline("target-box") instanceof win.ViewTimeline,
            ]
        })

        if (timelines) expect(timelines).toEqual([true, true])
    })

    test("holds either side of the page range", async ({ page }) => {
        await scrollThrough(page, pageBoxes, [
            [0, 0],
            [800, 0.5],
            [2000, 1],
            [800, 0.5],
            [0, 0],
            [2000, 1],
        ])
    })

    test("holds either side of the target's cover range", async ({
        page,
        browserName,
    }) => {
        skipBrokenViewTimeline(browserName)

        await scrollThrough(page, targetBoxes, [
            [1000, 0],
            [1875, 0.5],
            [2700, 1],
            [1875, 0.5],
            [1000, 0],
        ])
    })

    /**
     * The WAAPI boxes aren't checked: NativeAnimation.stop() doesn't stop
     * scroll-driven animations at their scroll position, with or without a
     * range.
     */
    test("stopping keeps JS values where they are", async ({ page }) => {
        await scrollTo(page, 800)
        await page.evaluate(() => (window as any).stopScroll())
        await scrollTo(page, 2000)

        expect(await readProgress(page, ["js-box", "x"])).toBeCloseTo(0.5, 1)
    })
})
