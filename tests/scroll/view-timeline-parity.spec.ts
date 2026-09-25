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

/**
 * Scrolls through the page, comparing the WAAPI (native) and JS-driven
 * (x) progress of every cell against the JS scrollInfo progress.
 */
async function findMismatches(page: Page, label = "") {
    const maxScroll = await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight
    )

    const mismatches: string[] = []

    for (let y = 0; y <= maxScroll; y += 50) {
        // scrollInfo doesn't track target resizes, so always fire a scroll
        await page.evaluate((y) => {
            window.scrollTo(0, y)
            window.dispatchEvent(new Event("scroll"))
        }, y)
        await nextFrames(page)

        for (const cell of await readCells(page)) {
            for (const key of ["native", "x"] as const) {
                if (Math.abs(cell[key] - cell.js) > 0.01) {
                    mismatches.push(
                        `${label}${cell.size} target, ${
                            cell.name
                        }, ${key} at ${y}px: ${cell[key].toFixed(
                            3
                        )} (JS ${cell.js.toFixed(3)})`
                    )
                }
            }
        }
    }

    return mismatches
}

async function findUnexpectedTimelines(page: Page) {
    return (await readCells(page))
        .filter((cell) => (cell.timeline === "ViewTimeline") !== cell.mapped)
        .map(
            (cell) =>
                `${cell.size} target, ${cell.name}: ${
                    cell.timeline
                }, expected ${cell.mapped ? "" : "no "}ViewTimeline`
        )
}

const skipWebKit = (browserName: string) =>
    test.skip(
        browserName === "webkit",
        "Playwright's WebKit exposes ViewTimeline but its progress doesn't follow scroll"
    )

test.describe("scroll() ViewTimeline and JS parity", () => {
    test.use({ viewport: { width: 500, height: 500 } })

    // Each test scrolls through the whole page, a few frames per position
    test.describe.configure({ timeout: 120_000 })

    test.beforeEach(async ({ page }) => {
        await page.goto("scroll/view-timeline-parity.html")
        await page.waitForFunction(() => (window as any).readCells)
        await page.waitForTimeout(100)
    })

    test("native and JS progress agree for every offset and target size", async ({
        page,
        browserName,
    }) => {
        skipWebKit(browserName)
        expect(await findMismatches(page)).toEqual([])
    })

    test("native and JS progress agree after resizes flip target sizes", async ({
        page,
        browserName,
    }) => {
        skipWebKit(browserName)

        // Swap the short and tall targets
        await page.evaluate(() => {
            document.getElementById("small")!.style.height = "800px"
            document.getElementById("large")!.style.height = "100px"
        })
        await nextFrames(page)
        const afterTargetResize = await findMismatches(page, "target resize: ")

        // Everything is now shorter than the viewport
        await page.setViewportSize({ width: 500, height: 1000 })
        await nextFrames(page)
        const afterViewportResize = await findMismatches(
            page,
            "viewport resize: "
        )

        expect([...afterTargetResize, ...afterViewportResize]).toEqual([])
        expect(await findUnexpectedTimelines(page)).toEqual([])
    })

    test("offsets with an exact ViewTimeline range run natively", async ({
        page,
    }) => {
        const supported = await page.evaluate(() => "ViewTimeline" in window)
        test.skip(!supported, "ViewTimeline is not supported")

        expect(await findUnexpectedTimelines(page)).toEqual([])
    })
})
