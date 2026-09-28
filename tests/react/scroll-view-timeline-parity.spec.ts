import { expect, Page, test } from "@playwright/test"

interface Cell {
    name: string
    size: string
    accelerated: boolean
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

const isWord = (cell: Cell) => cell.name.startsWith("word ")

async function findMismatches(
    page: Page,
    include: (cell: Cell) => boolean,
    label = ""
) {
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

        for (const cell of (await readCells(page)).filter(include)) {
            if (Math.abs(cell.native - cell.js) > 0.01) {
                mismatches.push(
                    `${label}${cell.size} target, ${
                        cell.name
                    } at ${y}px: ${cell.native.toFixed(
                        3
                    )} (JS ${cell.js.toFixed(3)})`
                )
            }
        }
    }

    return mismatches
}

/**
 * Every offset except one with a container edge at "center" has a
 * ViewTimeline range, so should be accelerated.
 */
const hasRange = (cell: Cell) => cell.name !== "start center, end start"

test.describe("useScroll target acceleration", () => {
    test.use({ viewport: { width: 500, height: 500 } })

    // Each test scrolls through the whole page, a few frames per position
    test.describe.configure({ timeout: 120_000 })

    test.beforeEach(async ({ page }) => {
        await page.goto("?test=scroll-view-timeline-parity")
        await page.waitForFunction(
            () => (window as any).readCells?.().length === 48
        )
        await page.waitForTimeout(100)
    })

    /**
     * Sweeps the page, then again after swapping the short and tall
     * targets, then after making the viewport taller than every target.
     */
    async function findMismatchesWithResizes(
        page: Page,
        include: (cell: Cell) => boolean
    ) {
        const mismatches = await findMismatches(page, include)

        await page.evaluate(() => {
            document.getElementById("small")!.style.height = "800px"
            document.getElementById("large")!.style.height = "100px"
        })
        mismatches.push(
            ...(await findMismatches(page, include, "target resize: "))
        )

        await page.setViewportSize({ width: 500, height: 1000 })
        mismatches.push(
            ...(await findMismatches(page, include, "viewport resize: "))
        )

        return mismatches
    }

    test("accelerated opacity matches JS progress, before and after resizes", async ({
        page,
    }) => {
        const supported = await page.evaluate(() => "ViewTimeline" in window)
        test.skip(!supported, "ViewTimeline is not supported")

        const unexpected = (await readCells(page))
            .filter(
                (cell) =>
                    cell.accelerated !== hasRange(cell) ||
                    (cell.timeline === "ViewTimeline") !== hasRange(cell)
            )
            .map(
                (cell) =>
                    `${cell.size} target, ${cell.name}: accelerated ${cell.accelerated}, ${cell.timeline}`
            )
        expect(unexpected).toEqual([])

        expect(
            await findMismatchesWithResizes(page, (cell) => !isWord(cell))
        ).toEqual([])
    })

    /**
     * #3658: each word's useTransform input range covers part of the
     * progress, so its accelerated keyframes need padding to offsets 0
     * and 1 to hold their end values.
     */
    test("accelerated per-word text reveals match JS progress (#3658)", async ({
        page,
    }) => {
        const supported = await page.evaluate(() => "ViewTimeline" in window)
        test.skip(!supported, "ViewTimeline is not supported")

        expect(await findMismatchesWithResizes(page, isWord)).toEqual([])
    })
})
