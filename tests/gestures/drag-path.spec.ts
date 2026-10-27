import { expect, Page, test } from "@playwright/test"
import { center, events, frames, pressAndMove } from "./drag-helpers"

/**
 * pathConstraints() against real SVG geometry. See drag-path.html: the
 * path's viewBox is drawn at 2x from page (100, 100).
 */

const open = async (page: Page, query = "") => {
    await page.goto(`gestures/drag-path.html${query}`)
    await frames(page, 2)
}

const expectCenter = async (page: Page, x: number, y: number) => {
    const point = await center(page, "#box")
    expect(point.x).toBeCloseTo(x, 0)
    expect(point.y).toBeCloseTo(y, 0)
}

const moveTo = async (page: Page, x: number, y: number) => {
    await page.mouse.move(x, y, { steps: 5 })
    await frames(page, 1)
}

test.describe("drag: pathConstraints", () => {
    test("holds the element within an SVG path's area", async ({ page }) => {
        await open(page)
        await pressAndMove(page, { x: 140, y: 140 }, { x: 600, y: 140 })

        await expectCenter(page, 500, 140)
        await page.mouse.up()
    })

    test("doesn't jump across a wall to the pointer", async ({ page }) => {
        await open(page)
        // Corridor B, across the wall at viewBox y 45 to 55
        await pressAndMove(page, { x: 140, y: 140 }, { x: 140, y: 260 })
        await expectCenter(page, 140, 190)

        await moveTo(page, 300, 260)
        await expectCenter(page, 300, 190)
        await page.mouse.up()
    })

    test("goes round the end of a wall with the pointer", async ({ page }) => {
        await open(page)
        await pressAndMove(page, { x: 140, y: 140 }, { x: 480, y: 140 })
        await moveTo(page, 480, 260)
        await moveTo(page, 200, 260)

        await expectCenter(page, 200, 260)
        await page.mouse.up()
    })

    test("constrains to path data relative to the element", async ({
        page,
    }) => {
        await open(page, "?mode=data")
        await pressAndMove(page, { x: 140, y: 140 }, { x: 500, y: 500 })

        await expectCenter(page, 340, 240)
        await page.mouse.up()
    })

    test("holds the element on a curve's stroke", async ({ page }) => {
        await open(page, "?mode=stroke")
        // Above the curve's peak at viewBox (100, 5)
        await pressAndMove(page, { x: 120, y: 260 }, { x: 300, y: 60 })
        await expectCenter(page, 300, 110)

        // Past its end at viewBox (190, 80)
        await moveTo(page, 600, 260)
        await expectCenter(page, 480, 260)
        await page.mouse.up()
    })

    test("follows a circle's stroke round", async ({ page }) => {
        await open(page, "?mode=circle")
        await pressAndMove(page, { x: 220, y: 200 }, { x: 300, y: 60 })
        await expectCenter(page, 300, 120)

        await moveTo(page, 450, 200)
        await expectCenter(page, 380, 200)
        await moveTo(page, 300, 350)
        await expectCenter(page, 300, 280)
        await page.mouse.up()
    })

    test("elastic overshoots the edge and springs back on release", async ({
        page,
    }) => {
        await open(page, "?elastic=0.5")
        await pressAndMove(page, { x: 140, y: 140 }, { x: 600, y: 140 })
        await expectCenter(page, 550, 140)

        await page.mouse.up()
        await expect.poll(() => events(page)).toContain("transitionEnd")
        await expectCenter(page, 500, 140)
    })

    test("elastic doesn't draw the element across a wall", async ({ page }) => {
        await open(page, "?elastic=0.35")
        // The wall runs from page y 190 to 210
        await pressAndMove(page, { x: 140, y: 140 }, { x: 140, y: 400 })

        const { y } = await center(page, "#box")
        expect(y).toBeGreaterThan(190)
        expect(y).toBeLessThanOrEqual(200.5)
        await page.mouse.up()
    })

    test("momentum doesn't carry the element across a wall", async ({
        page,
    }) => {
        await open(page, "?momentum=true")
        await page.mouse.move(140, 140)
        await page.mouse.down()
        await page.mouse.move(140, 150)
        await page.mouse.move(140, 170)
        await page.mouse.move(140, 185)
        await page.mouse.up()

        await expect.poll(() => events(page)).toContain("transitionEnd")
        const { y } = await center(page, "#box")
        expect(y).toBeLessThanOrEqual(190.5)
    })
})
