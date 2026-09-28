import { expect, Page, test } from "@playwright/test"

const nextFrames = (page: Page) =>
    page.evaluate(
        () =>
            new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                    requestAnimationFrame(() =>
                        requestAnimationFrame(() => resolve())
                    )
                )
            )
    )

const scrollTo = async (page: Page, y: number) => {
    await page.evaluate((y) => window.scrollTo(0, y), y)
    await nextFrames(page)
}

const scrollListeners = (page: Page) =>
    page.evaluate(() => (window as any).scrollListeners() as number)

const opacity = (page: Page, id: string) =>
    page.evaluate(
        (id) => parseFloat(getComputedStyle(document.getElementById(id)!).opacity),
        id
    )

/**
 * The accelerated opacities follow the scroll natively, so they're what
 * values read from JS should match.
 */
async function expectReadsToMatchNative(page: Page) {
    await page.click("#read")
    const read = await page.evaluate(() => ({
        ...document.getElementById("read")!.dataset,
    }))
    expect(parseFloat(read.page!)).toBeCloseTo(
        await opacity(page, "page-opacity"),
        2
    )
    expect(parseFloat(read.target!)).toBeCloseTo(
        await opacity(page, "target-opacity"),
        2
    )
}

test.describe("useScroll JS tracking", () => {
    test.use({ viewport: { width: 500, height: 500 } })

    test.beforeEach(async ({ page }) => {
        await page.goto("?test=scroll-lazy-tracking")
        await page.waitForSelector("#read")
        await nextFrames(page)

        const supported = await page.evaluate(
            () => "ScrollTimeline" in window && "ViewTimeline" in window
        )
        test.skip(!supported, "Native scroll timelines are not supported")

        expect(
            await page.evaluate(() =>
                ["page-opacity", "target-opacity"].map(
                    (id) =>
                        document.getElementById(id)!.getAnimations()[0]
                            ?.timeline?.constructor.name
                )
            )
        ).toEqual(["ScrollTimeline", "ViewTimeline"])
    })

    test("only accelerated consumers: no JS tracking, and reads match the native progress", async ({
        page,
    }) => {
        for (const y of [0, 800, 1500, 2600]) {
            await scrollTo(page, y)
            expect(await scrollListeners(page)).toBe(0)
            await expectReadsToMatchNative(page)
        }
    })

    test("a JS subscriber added mid-scroll follows the scroll, and tracking stops when it's removed", async ({
        page,
    }) => {
        await scrollTo(page, 1200)
        await page.click("#subscribe")
        await nextFrames(page)
        expect(await scrollListeners(page)).toBe(1)

        await scrollTo(page, 1800)
        const subscriber = await page.textContent("#subscriber")
        expect(parseFloat(subscriber!)).toBeCloseTo(
            await opacity(page, "page-opacity"),
            2
        )

        await page.click("#subscribe")
        await nextFrames(page)
        expect(await scrollListeners(page)).toBe(0)

        await scrollTo(page, 2400)
        await expectReadsToMatchNative(page)
    })

    test("mixed accelerated and JS consumers stay in step", async ({
        page,
    }) => {
        await page.click("#mix")
        await nextFrames(page)
        expect(await scrollListeners(page)).toBe(1)

        for (const y of [1000, 1700, 2300]) {
            await scrollTo(page, y)
            const x = await page.evaluate(
                () =>
                    new DOMMatrix(
                        getComputedStyle(document.getElementById("mixed")!)
                            .transform
                    ).m41
            )
            expect(x / 100).toBeCloseTo(
                await opacity(page, "target-opacity"),
                2
            )
        }

        await page.click("#mix")
        await nextFrames(page)
        expect(await scrollListeners(page)).toBe(0)
    })
})
