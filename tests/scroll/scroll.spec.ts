import { expect, Locator, Page, test } from "@playwright/test"

async function eachBox(
    page: Page,
    callback: (box: Locator, index: number) => Promise<void>
) {
    const boxes = page.locator(".box")
    const count = await boxes.count()
    expect(count).toBe(3)
    await callback(boxes.nth(0), 0)
    await callback(boxes.nth(1), 1)
    await callback(boxes.nth(2), 2)
}

async function eachStaggerBox(
    page: Page,
    callback: (box: Locator, index: number) => Promise<void>
) {
    const boxes = page.locator(".box")
    const count = await boxes.count()
    expect(count).toBe(12) // 3 groups × 4 boxes each
    for (let i = 0; i < count; i++) {
        await callback(boxes.nth(i), i)
    }
}

async function settle(page: Page) {
    await page.evaluate(
        () =>
            new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve))
            )
    )
}

async function readProgress(page: Page, name: string) {
    return page.evaluate((key) => {
        const { progress, infoProgress } = (window as any).results[key]
        return {
            progress,
            infoProgress,
            native: (window as any).readNativeProgress(key),
        }
    }, name)
}

test.describe("scroll() progress callbacks", () => {
    test.use({ viewport: { width: 500, height: 500 } })

    test.beforeEach(async ({ page }) => {
        await page.goto("scroll/scroll-callback-progress.html")
        await settle(page)
    })

    test("page scroll progress matches scroll position and native ScrollTimeline", async ({
        page,
    }) => {
        const maxScroll = await page.evaluate(
            () =>
                document.documentElement.scrollHeight -
                document.documentElement.clientHeight
        )

        for (const fraction of [0, 0.25, 0.617, 1]) {
            const scrollTop = Math.round(maxScroll * fraction)
            await page.evaluate((y) => window.scrollTo(0, y), scrollTop)
            await settle(page)

            const { progress, infoProgress, native } = await readProgress(
                page,
                "page"
            )
            expect(progress).toBeCloseTo(scrollTop / maxScroll, 3)
            expect(progress).toBe(infoProgress)
            if (native !== undefined) expect(progress).toBeCloseTo(native, 3)
        }
    })

    test("element container progress matches scroll position and native ScrollTimeline, y and x axis", async ({
        page,
    }) => {
        for (const [left, top] of [
            [0, 0],
            [200, 400],
            [800, 800],
        ]) {
            await page.evaluate(
                ([x, y]) => document.getElementById("scroller")!.scrollTo(x, y),
                [left, top]
            )
            await settle(page)

            for (const [name, expected] of [
                ["container", top / 800],
                ["source", top / 800],
                ["x", left / 800],
            ] as const) {
                const { progress, infoProgress, native } = await readProgress(
                    page,
                    name
                )
                expect(progress).toBeCloseTo(expected, 3)
                expect(progress).toBe(infoProgress)
                if (native !== undefined) {
                    expect(progress).toBeCloseTo(native, 3)
                }
            }
        }
    })

    test("target progress matches the target's position in the viewport", async ({
        page,
    }) => {
        const { targetTop, viewport, targetHeight } = await page.evaluate(
            () => {
                const target = document.getElementById("target")!
                return {
                    targetTop: target.offsetTop,
                    targetHeight: target.offsetHeight,
                    viewport: document.documentElement.clientHeight,
                }
            }
        )

        for (const scrollTop of [
            0,
            targetTop - viewport + 150,
            targetTop,
            targetTop + targetHeight,
        ]) {
            await page.evaluate((y) => window.scrollTo(0, y), scrollTop)
            await settle(page)

            const top = targetTop - scrollTop
            const expected = Math.min(
                1,
                Math.max(0, (viewport - top) / (viewport + targetHeight))
            )
            const { progress, infoProgress } = await readProgress(
                page,
                "target"
            )
            expect(progress).toBeCloseTo(expected, 3)
            expect(progress).toBe(infoProgress)
        }
    })

    test("non-scrollable container reports the same progress as scroll info", async ({
        page,
    }) => {
        const { progress, infoProgress } = await readProgress(page, "static")
        expect(progress).toBe(infoProgress)
    })
})

test.describe("scroll()", () => {
    test.use({ viewport: { width: 500, height: 500 } })

    test("delay - animations with delay should be less than halfway when scrolled halfway", async ({
        page,
    }) => {
        await page.goto("scroll/scroll-delay.html")
        await page.reload()

        // Get the total scroll height (400vh)
        const totalScrollHeight = await page.evaluate(() => {
            return document.documentElement.scrollHeight - window.innerHeight
        })

        // Scroll to halfway point
        const halfwayScroll = totalScrollHeight / 2
        await page.evaluate((scrollY) => {
            window.scrollTo(0, scrollY)
        }, halfwayScroll)

        // Wait a moment for scroll-triggered animations to update
        await page.waitForTimeout(100)

        await eachBox(page, async (box) => {
            const boundingBox = await box.boundingBox()
            // The animation goes from 0 to 100px translateX
            // With delay, when we're halfway through scroll, the animation should be less than 50px
            // because the delay means the animation starts later in the scroll timeline
            expect(boundingBox?.x).toBeLessThan(50)
            expect(boundingBox?.x).toBeGreaterThan(0)
        })

        // Now scroll to the bottom of the page
        await page.evaluate((scrollY) => {
            window.scrollTo(0, scrollY)
        }, totalScrollHeight)

        // Wait for animations to complete
        await page.waitForTimeout(100)

        // At the bottom, all boxes should be at 100px translateX
        await eachBox(page, async (box) => {
            const boundingBox = await box.boundingBox()
            expect(boundingBox?.x).toBeCloseTo(100, 1)
        })
    })

    test("stagger - animations with stagger delay should all be at 100px at bottom", async ({
        page,
    }) => {
        await page.goto("scroll/scroll-stagger.html")
        await page.reload()

        // Record the initial bounding box x for each box
        const initialXs: number[] = []
        await eachStaggerBox(page, async (box) => {
            const boundingBox = await box.boundingBox()
            initialXs.push(boundingBox?.x ?? 0)
        })

        // Get the total scroll height (400vh)
        const totalScrollHeight = await page.evaluate(() => {
            return document.documentElement.scrollHeight - window.innerHeight
        })

        // Scroll to the bottom of the page
        await page.evaluate((scrollY) => {
            window.scrollTo(0, scrollY)
        }, totalScrollHeight)

        // Wait for animations to complete
        await page.waitForTimeout(100)

        // At the bottom, all boxes should be at 100px translateX from their initial position regardless of stagger
        let i = 0
        await eachStaggerBox(page, async (box) => {
            const boundingBox = await box.boundingBox()
            const initialX = initialXs[i++]
            expect(boundingBox?.x).toBeCloseTo(initialX + 100, 1)
        })
    })
})

test.describe("scroll() with a spring between strings", () => {
    test("scrolls x in pixels with its default spring", async ({ page }) => {
        await page.goto("scroll/scroll-spring-px.html")
        await settle(page)

        const maxScroll = await page.evaluate(
            () => document.documentElement.scrollHeight - window.innerHeight
        )

        for (const fraction of [0.5, 1]) {
            await page.evaluate(
                (y) => window.scrollTo(0, y),
                Math.round(maxScroll * fraction)
            )
            await page.waitForTimeout(100)

            /**
             * Where it shows, as it can run on the compositor, which
             * doesn't write its style.
             */
            const box = await page.locator("#box").boundingBox()
            expect(box?.x).toBeCloseTo(100 * fraction, 0)
        }
    })
})

test.describe("scroll() with an animation of several values", () => {
    test.use({ viewport: { width: 500, height: 500 } })

    const read = (page: Page, id: string) =>
        page.evaluate((id) => {
            const element = document.getElementById(id)!
            const style = getComputedStyle(element)
            return {
                x: new DOMMatrixReadOnly(style.transform).m41,
                width: parseFloat(style.width),
                height: parseFloat(style.height),
                opacity: parseFloat(style.opacity),
            }
        }, id)

    const scrollTo = async (page: Page, progress: number) => {
        await page.evaluate((progress) => {
            window.scrollTo(
                0,
                (document.documentElement.scrollHeight - window.innerHeight) *
                    progress
            )
        }, progress)
        await page.waitForTimeout(100)
    }

    test.beforeEach(async ({ page }) => {
        await page.goto("scroll/scroll-mixed-values.html")
        await settle(page)
    })

    test("a transform follows the scroll alongside a main thread value", async ({
        page,
    }) => {
        for (const progress of [0.5, 0.25, 1]) {
            await scrollTo(page, progress)
            const { x, width } = await read(page, "mixed")
            expect(x).toBeCloseTo(200 * progress, 0)
            expect(width).toBeCloseTo(100 + 100 * progress, 0)
        }
    })

    test("a transform and opacity follow the scroll alongside a main thread value", async ({
        page,
    }) => {
        for (const progress of [0.5, 0.25, 1]) {
            await scrollTo(page, progress)
            const { x, opacity, height } = await read(page, "mixed-opacity")
            expect(x).toBeCloseTo(200 * progress, 0)
            expect(opacity).toBeCloseTo(1 - progress, 1)
            expect(height).toBeCloseTo(100 + 100 * progress, 0)
        }
    })

    test("values with different durations each span the scroll", async ({
        page,
    }) => {
        for (const progress of [0.25, 0.5, 1]) {
            await scrollTo(page, progress)
            const { width, height } = await read(page, "durations")
            expect(width).toBeCloseTo(100 + 100 * progress, 0)
            expect(height).toBeCloseTo(100 + 100 * progress, 0)
        }
    })

    test("values with default transitions each span the scroll", async ({
        page,
    }) => {
        for (const progress of [0.25, 0.5, 1]) {
            await scrollTo(page, progress)
            const { x, width } = await read(page, "defaults")
            expect(x).toBeCloseTo(200 * progress, 0)
            expect(width).toBeCloseTo(100 + 100 * progress, 0)
        }
    })
})
