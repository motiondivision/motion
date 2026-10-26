import { CDPSession, expect, Page, test } from "@playwright/test"
import { frames, rect } from "./drag-helpers"

/**
 * pinch() with real browser input. Touches go through CDP so Chromium
 * produces real touch pointer events (hit testing, implicit capture,
 * touch-action); trackpad pinches are ctrl + wheel, as Chromium reports
 * them. The 100x100 box starts at (100, 100).
 */

type Touch = { x: number; y: number }

const open = async (page: Page, query = "") => {
    await page.goto(`gestures/pinch.html${query}`)
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

/**
 * Put two touches down, move them to `to` in a few steps, then lift them.
 */
async function twoFinger(
    page: Page,
    from: [Touch, Touch],
    to: [Touch, Touch],
    { steps = 5, lift = true } = {}
) {
    const cdp = await page.context().newCDPSession(page)
    await touch(cdp, "touchStart", from)
    await frames(page, 2)

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
    await frames(page, 2)

    if (lift) {
        await touch(cdp, "touchEnd", [])
        await frames(page, 2)
    }
    return cdp
}

const events = (page: Page) => page.evaluate(() => (window as any).events)

test.describe("pinch", () => {
    test.beforeEach(({ browserName }) => {
        test.skip(browserName !== "chromium", "Touch input needs CDP")
    })

    test("two touches scale the box around the point between them", async ({
        page,
    }) => {
        await open(page)

        // Spread 2x around (175, 150), inside the box's right half.
        await twoFinger(
            page,
            [
                { x: 160, y: 150 },
                { x: 190, y: 150 },
            ],
            [
                { x: 145, y: 150 },
                { x: 205, y: 150 },
            ]
        )

        // (175, 150) stays put: left = 175 - (175 - 100) * 2
        expect(await rect(page, "#box")).toEqual({
            left: 25,
            top: 50,
            right: 225,
            bottom: 250,
            width: 200,
            height: 200,
        })
        expect(await events(page)).toEqual(["start", "end"])
    })

    test("two touches move and rotate the box", async ({ page }) => {
        await open(page, "?rotate")

        // Rotate 90deg around the centre (150, 150), then move it 50px right.
        await twoFinger(
            page,
            [
                { x: 125, y: 150 },
                { x: 175, y: 150 },
            ],
            [
                { x: 200, y: 125 },
                { x: 200, y: 175 },
            ]
        )

        const box = await rect(page, "#box")
        expect(box.left).toBeCloseTo(150, 0)
        expect(box.top).toBeCloseTo(100, 0)
        expect(box.width).toBeCloseTo(100, 0)
        const info = await page.evaluate(() => (window as any).lastInfo)
        expect(info.rotate).toBeCloseTo(90, 1)
        expect(info.scale).toBeCloseTo(1, 2)
        expect(info.offset.x).toBeCloseTo(50, 1)
    })

    test("the page doesn't zoom or scroll", async ({ page }) => {
        await open(page)
        expect(
            await page.locator("#box").evaluate((el) => el.style.touchAction)
        ).toBe("none")
    })

    test("composes with drag(): drag owns position", async ({ page }) => {
        await open(page, "?drag")

        const cdp = await page.context().newCDPSession(page)
        // First touch drags 20px right...
        await touch(cdp, "touchStart", [{ x: 150, y: 150 }])
        await frames(page, 1)
        for (const x of [155, 160, 170]) {
            await touch(cdp, "touchMove", [{ x, y: 150 }])
            await frames(page, 1)
        }
        // ...then a second touch pinches 2x.
        await touch(cdp, "touchStart", [
            { x: 170, y: 150 },
            { x: 190, y: 150 },
        ])
        await frames(page, 2)
        await touch(cdp, "touchMove", [
            { x: 170, y: 150 },
            { x: 210, y: 150 },
        ])
        await frames(page, 3)

        const { width } = await rect(page, "#box")
        expect(width).toBeCloseTo(200, 0)
        const transform = await page
            .locator("#box")
            .evaluate((el) => el.style.transform)
        expect(transform).toBe("translateX(20px) scale(2)")

        await touch(cdp, "touchEnd", [])
    })
})

test.describe("pinch with a trackpad", () => {
    test("ctrl + wheel zooms around the cursor and doesn't zoom the page", async ({
        page,
    }) => {
        await open(page)
        await page.mouse.move(100, 100) // the box's top-left corner

        await page.keyboard.down("Control")
        for (let i = 0; i < 10; i++) {
            await page.mouse.wheel(0, (-100 * Math.log(2)) / 10)
            await frames(page, 1)
        }
        await page.keyboard.up("Control")
        await frames(page, 2)

        const box = await rect(page, "#box")
        expect(box.left).toBeCloseTo(100, 0)
        expect(box.top).toBeCloseTo(100, 0)
        expect(box.width).toBeCloseTo(200, 0)

        await expect.poll(() => events(page)).toEqual(["start", "end"])
        expect(await page.evaluate(() => window.visualViewport!.scale)).toBe(1)
    })
})
