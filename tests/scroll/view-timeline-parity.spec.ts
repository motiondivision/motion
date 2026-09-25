import { expect, Page, test } from "@playwright/test"

interface Cell {
    name: string
    size: string
    mapped: boolean
    js: number
    native: number
    x: number
    timeline?: string
}

const readCells = (page: Page) =>
    page.evaluate(() => (window as any).readCells() as Cell[])

const scrollTo = async (page: Page, y: number) => {
    await page.evaluate((y) => window.scrollTo(0, y), y)
    await page.evaluate(
        () =>
            new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                    requestAnimationFrame(() =>
                        requestAnimationFrame(() => resolve())
                    )
                )
            )
    )
}

test.describe("scroll() ViewTimeline and JS parity", () => {
    test.use({ viewport: { width: 500, height: 500 } })

    test.beforeEach(async ({ page }) => {
        await page.goto("scroll/view-timeline-parity.html")
        await page.waitForFunction(() => (window as any).readCells)
        await page.waitForTimeout(100)
    })

    test("native and JS progress agree for every offset and target size", async ({
        page,
    }) => {
        const maxScroll = await page.evaluate(
            () => document.documentElement.scrollHeight - window.innerHeight
        )

        const mismatches: string[] = []

        for (let y = 0; y <= maxScroll; y += 50) {
            await scrollTo(page, y)

            for (const cell of await readCells(page)) {
                for (const key of ["native", "x"] as const) {
                    if (Math.abs(cell[key] - cell.js) > 0.01) {
                        mismatches.push(
                            `${cell.size} target, ${cell.name}, ${key} at ${y}px: ${cell[
                                key
                            ].toFixed(3)} (JS ${cell.js.toFixed(3)})`
                        )
                    }
                }
            }
        }

        expect(mismatches).toEqual([])
    })

    test("offsets with an exact ViewTimeline range run natively", async ({
        page,
    }) => {
        const supported = await page.evaluate(() => "ViewTimeline" in window)
        test.skip(!supported, "ViewTimeline is not supported")

        const unexpected = (await readCells(page))
            .filter((cell) => (cell.timeline === "ViewTimeline") !== cell.mapped)
            .map(
                (cell) =>
                    `${cell.size} target, ${cell.name}: ${cell.timeline}, expected ${
                        cell.mapped ? "" : "no "
                    }ViewTimeline`
            )

        expect(unexpected).toEqual([])
    })
})
