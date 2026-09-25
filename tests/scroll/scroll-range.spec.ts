import { expect, Page, test } from "@playwright/test"

/**
 * #3001: scroll() rangeStart/rangeEnd deactivate the animation outside the
 * range, so the base CSS (opacity 0.1, translateX(300px)) applies with no
 * inline style left behind.
 *
 * With a 1000px viewport the page scrolls 4000px, so the page range 0%–20%
 * is 0–800px. #target is 500px tall at top 2500px, so its cover range runs
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

const allTargetBoxes: Box[] = [
    ["target-box", "opacity"],
    ["target-js-box", "x"],
]

/**
 * Playwright's WebKit exposes ViewTimeline but its currentTime doesn't follow
 * scroll (also on main, without a range), so only the JS box is checked there.
 */
const getTargetBoxes = (browserName: string) =>
    browserName === "webkit"
        ? allTargetBoxes.filter(([, value]) => value === "x")
        : allTargetBoxes

const readBox = (page: Page, id: string) =>
    page.evaluate((elementId) => {
        const element = document.getElementById(elementId)!
        const { opacity, transform } = getComputedStyle(element)
        return {
            opacity: parseFloat(opacity),
            x: transform === "none" ? 0 : new DOMMatrix(transform).m41,
            inlineOpacity: element.style.opacity,
            inlineTransform: element.style.transform,
        }
    }, id)

async function scrollTo(page: Page, y: number) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y)
    await page.waitForTimeout(100)
}

async function expectActive(page: Page, boxes: Box[], progress: number) {
    for (const [id, value] of boxes) {
        const box = await readBox(page, id)
        const boxProgress = value === "opacity" ? box.opacity : box.x / 100
        expect(boxProgress, id).toBeCloseTo(progress, 1)
    }
}

async function expectInactive(page: Page, boxes: Box[]) {
    for (const [id, value] of boxes) {
        const box = await readBox(page, id)
        if (value === "opacity") {
            expect(box.opacity, id).toBeCloseTo(0.1, 2)
            expect(box.inlineOpacity, id).toBe("")
        } else {
            expect(box.x, id).toBeCloseTo(300, 0)
            expect(box.inlineTransform, id).toBe("")
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

    test("page range", async ({ page }) => {
        await scrollTo(page, 600)
        await expectActive(page, pageBoxes, 0.75)

        await scrollTo(page, 2000)
        await expectInactive(page, pageBoxes)

        await scrollTo(page, 600)
        await expectActive(page, pageBoxes, 0.75)
    })

    test("no inline start value outside the range", async ({ page }) => {
        // Start read from the element (0.1), three quarters of the way to 1.
        await scrollTo(page, 600)
        expect((await readBox(page, "implicit-box")).opacity).toBeCloseTo(
            0.775,
            1
        )

        await scrollTo(page, 2000)
        await expectInactive(page, [["implicit-box", "opacity"]])

        await scrollTo(page, 600)
        expect((await readBox(page, "implicit-box")).opacity).toBeCloseTo(
            0.775,
            1
        )
    })

    test("target cover range", async ({ page, browserName }) => {
        const targetBoxes = getTargetBoxes(browserName)

        await scrollTo(page, 1000)
        await expectInactive(page, targetBoxes)

        await scrollTo(page, 1875)
        await expectActive(page, targetBoxes, 0.5)

        await scrollTo(page, 2700)
        await expectInactive(page, targetBoxes)

        await scrollTo(page, 1875)
        await expectActive(page, targetBoxes, 0.5)
    })

    test("stopping outside the range leaves it inactive", async ({
        page,
        browserName,
    }) => {
        await scrollTo(page, 1000)
        await page.evaluate(() => (window as any).stopScroll())
        await page.waitForTimeout(100)

        await expectInactive(page, pageBoxes)
        await expectInactive(page, getTargetBoxes(browserName))
    })
})
