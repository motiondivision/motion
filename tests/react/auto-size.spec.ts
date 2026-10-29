/**
 * useAutoSize animates an element's height between two auto sizes when
 * its content changes, over a 1s linear transition.
 */
import { expect, Page, test } from "@playwright/test"

async function load(page: Page, query = "") {
    await page.goto(`?test=auto-size${query}`)
    await expect(page.locator("#toggle")).toBeVisible()
    await page.waitForTimeout(200)
}

/**
 * Click a button and return every frame's height recorded from then on.
 */
async function record(page: Page, id: string, ms: number) {
    const start = await page.evaluate(() => window.heights.length)
    await page.click("#" + id)
    await page.waitForTimeout(ms)
    return page.evaluate((start) => window.heights.slice(start), start)
}

function expectSmooth(heights: number[], from: number, to: number) {
    // No frame shows the new size before animating (no flash)
    expect(Math.abs(heights[0] - from)).toBeLessThan(20)
    // Never jumps more than ~5% of the distance in a frame (1s at 60fps
    // moves under 2% a frame, allow for dropped frames)
    const max = Math.abs(to - from) * 0.1
    for (let i = 1; i < heights.length; i++) {
        expect(Math.abs(heights[i] - heights[i - 1])).toBeLessThan(max)
    }
    // Passes through the middle
    expect(
        heights.some((h) => Math.abs(h - (from + to) / 2) < Math.abs(to - from) / 4)
    ).toBe(true)
    expect(heights[heights.length - 1]).toBeCloseTo(to, 0)
}

test("animates height when content grows", async ({ page }) => {
    await load(page)
    const heights = await record(page, "h300", 1300)
    expectSmooth(heights, 100, 300)
    // Returns to auto once finished
    expect(
        await page.evaluate(() => document.getElementById("box")!.style.height)
    ).toBe("")
})

test("animates height when content shrinks", async ({ page }) => {
    await load(page)
    await page.click("#h300")
    await page.waitForTimeout(1300)
    const heights = await record(page, "h100", 1300)
    expectSmooth(heights, 300, 100)
})

test("retargets when content changes mid-animation", async ({ page }) => {
    await load(page)
    const start = await page.evaluate(() => window.heights.length)
    await page.click("#h300")
    await page.waitForTimeout(500)
    await page.click("#h500")
    await page.waitForTimeout(1400)
    const heights = await page.evaluate((s) => window.heights.slice(s), start)
    expectSmooth(heights, 100, 500)
    // Finishes within a second of the retarget, rather than finishing the
    // first animation and then starting another
    expect(heights.findIndex((h) => h > 499)).toBeLessThan(
        heights.length - 5
    )
})

test("the element below moves with it", async ({ page }) => {
    await load(page)
    const top = () =>
        page.evaluate(() => document.getElementById("below")!.getBoundingClientRect().top)
    const before = await top()
    await page.click("#h300")
    await page.waitForTimeout(500)
    const mid = (await top()) - before
    expect(mid).toBeGreaterThan(50)
    expect(mid).toBeLessThan(150)
})

test("snaps when the width changes the height (reflow)", async ({ page }) => {
    await load(page, "&aspect=true")
    // 100 + 400 / 2
    expect((await page.locator("#box").boundingBox())!.height).toBeCloseTo(300, 0)
    const heights = await record(page, "narrow", 300)
    // Straight to 100 + 200 / 2, with no frames in between
    const changed = heights.find((h) => Math.abs(h - 300) > 0.5)
    expect(changed).toBeCloseTo(200, 0)
})

test("animates width too with axis: both", async ({ page }) => {
    await load(page, "&axis=both")
    const start = await page.evaluate(() => window.widths.length)
    await page.click("#h300")
    await page.waitForTimeout(500)
    const widths = await page.evaluate((s) => window.widths.slice(s), start)
    const w = widths[widths.length - 1]
    expect(w).toBeGreaterThan(150)
    expect(w).toBeLessThan(250)
})

test("works alongside animate={{ height: open ? 'auto' : 0 }}", async ({
    page,
}) => {
    await load(page, "&accordion=true")
    expectSmooth(await record(page, "toggle", 1300), 0, 100)
    expectSmooth(await record(page, "h300", 1300), 100, 300)
    expectSmooth(await record(page, "toggle", 1300), 300, 0)
    expect(
        await page.evaluate(() => document.getElementById("box")!.style.height)
    ).toBe("0px")
})
