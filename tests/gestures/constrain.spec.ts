import { CDPSession, expect, Page, test } from "@playwright/test"
import { frames } from "./drag-helpers"

/**
 * constrain() setting drag() and pinch() constraints, with real browser input. A
 * 300x300 photo fills a 300x300 frame at (100, 100), centred on
 * (250, 250). At 2x the photo is 600px wide, so it can move 150px either
 * way before an edge shows.
 */

type Touch = { x: number; y: number }

const open = async (page: Page) => {
    await page.goto("gestures/constrain.html")
    await frames(page, 2)
}

const touch = (
    cdp: CDPSession,
    type: "touchStart" | "touchMove" | "touchEnd",
    points: Touch[]
) =>
    cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: points.map(({ x, y }, id) => ({ x, y, id })),
    })

const values = (page: Page) =>
    page.evaluate(() => (window as any).values()) as Promise<{
        x: number
        y: number
        scale: number
    }>

async function moveTouches(
    page: Page,
    cdp: CDPSession,
    from: [Touch, Touch],
    to: [Touch, Touch],
    steps = 5
) {
    for (let i = 1; i <= steps; i++) {
        const p = i / steps
        await touch(
            cdp,
            "touchMove",
            from.map((f, j) => ({
                x: f.x + (to[j].x - f.x) * p,
                y: f.y + (to[j].y - f.y) * p,
            }))
        )
        await frames(page, 1)
    }
}

/**
 * Spread two touches 2x around the frame's centre, then move them by
 * `panX`. Returns the CDP session with the touches still down.
 */
async function zoomAndPan(page: Page, panX: number) {
    const cdp = await page.context().newCDPSession(page)
    const start: [Touch, Touch] = [
        { x: 220, y: 250 },
        { x: 280, y: 250 },
    ]
    const spread: [Touch, Touch] = [
        { x: 190, y: 250 },
        { x: 310, y: 250 },
    ]
    await touch(cdp, "touchStart", start)
    await frames(page, 2)
    await moveTouches(page, cdp, start, spread)
    await moveTouches(
        page,
        cdp,
        spread,
        spread.map((p) => ({ x: p.x + panX, y: p.y })) as [Touch, Touch],
        10
    )
    return cdp
}

const settle = (page: Page) => page.waitForTimeout(1200)

test.describe("constrain", () => {
    test.beforeEach(({ browserName }) => {
        test.skip(browserName !== "chromium", "Touch input needs CDP")
    })

    test("a pinch pans past the edge with elastic, and springs back to it", async ({
        page,
    }) => {
        await open(page)
        const cdp = await zoomAndPan(page, 300)

        const during = await values(page)
        expect(during.scale).toBeCloseTo(2, 1)
        expect(during.x).toBeGreaterThan(150)
        expect(during.x).toBeLessThan(300)

        await touch(cdp, "touchEnd", [])
        await settle(page)

        const after = await values(page)
        expect(after.scale).toBeCloseTo(2, 1)
        expect(after.x).toBeCloseTo(150, 0)
    })

    test("a drag after a zoom stops at the scaled edge", async ({ page }) => {
        await open(page)
        const cdp = await zoomAndPan(page, 0)
        await touch(cdp, "touchEnd", [])
        await settle(page)

        await page.mouse.move(250, 250)
        await page.mouse.down()
        for (let x = 270; x <= 650; x += 40) {
            await page.mouse.move(x, 250)
            await frames(page, 1)
        }
        await page.mouse.up()
        await settle(page)

        const { x, scale } = await values(page)
        expect(scale).toBeCloseTo(2, 1)
        expect(x).toBeCloseTo(150, 0)
    })

    test("animate() isn't constrained", async ({ page }) => {
        await open(page)
        const cdp = await zoomAndPan(page, 300)
        await touch(cdp, "touchEnd", [])
        await settle(page)
        expect((await values(page)).x).toBeCloseTo(150, 0)

        // Constraints only apply to gestures
        await page.evaluate(() => (window as any).zoomTo(1))
        await settle(page)

        const { x, scale } = await values(page)
        expect(scale).toBe(1)
        expect(x).toBeCloseTo(150, 0)
    })

    test("bounds.at() gives the limits at a scale", async ({ page }) => {
        await open(page)
        const limits = await page.evaluate(() =>
            (window as any).bounds.at({ scale: 2.5 })
        )
        expect(limits).toEqual({
            left: -225,
            right: 225,
            top: -225,
            bottom: 225,
        })
    })
})
