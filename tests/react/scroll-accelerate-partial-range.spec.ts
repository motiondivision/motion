import { expect, Page, test } from "@playwright/test"

interface Cell {
    name: string
    js: number
    native: number
    timeline?: string
}

const readCells = (page: Page) =>
    page.evaluate(() => (window as any).readCells() as Cell[])

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

test.describe("useTransform acceleration with a partial input range", () => {
    test.use({ viewport: { width: 500, height: 500 } })

    test.beforeEach(async ({ page }) => {
        await page.goto("?test=scroll-accelerate-partial-range")
        await page.waitForFunction(
            () => (window as any).readCells?.().length === 9
        )
        await page.waitForTimeout(100)
    })

    test("accelerated opacity matches the JS transform across the whole scroll", async ({
        page,
    }) => {
        const supported = await page.evaluate(() => "ScrollTimeline" in window)
        test.skip(!supported, "ScrollTimeline is not supported")

        expect(
            (await readCells(page))
                .filter((cell) => cell.timeline !== "ScrollTimeline")
                .map((cell) => `${cell.name}: ${cell.timeline}`)
        ).toEqual([])

        const maxScroll = await page.evaluate(
            () => document.documentElement.scrollHeight - window.innerHeight
        )
        const mismatches: string[] = []

        for (let y = 0; y <= maxScroll; y += 50) {
            await page.evaluate((y) => window.scrollTo(0, y), y)
            await nextFrames(page)

            for (const cell of await readCells(page)) {
                if (Math.abs(cell.native - cell.js) > 0.01) {
                    mismatches.push(
                        `${cell.name} at ${y}px: ${cell.native.toFixed(
                            3
                        )} (JS ${cell.js.toFixed(3)})`
                    )
                }
            }
        }

        expect(mismatches).toEqual([])
    })
})
