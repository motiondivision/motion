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
        expect(await events(page)).toEqual(["start", "end:pointerup"])
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

    test("the browser doesn't take over the gesture", async ({ page }) => {
        await open(page)
        await twoFinger(
            page,
            [
                { x: 140, y: 150 },
                { x: 160, y: 150 },
            ],
            [
                { x: 110, y: 150 },
                { x: 190, y: 150 },
            ]
        )

        expect(await page.evaluate(() => window.visualViewport!.scale)).toBe(1)
        expect((await rect(page, "#box")).width).toBeCloseTo(400, 0)
    })

    test("pinches when the second touch lands beside the box", async ({
        page,
    }) => {
        await open(page)
        await twoFinger(
            page,
            [
                { x: 180, y: 150 },
                { x: 230, y: 150 },
            ],
            [
                { x: 155, y: 150 },
                { x: 255, y: 150 },
            ]
        )

        expect((await rect(page, "#box")).width).toBeCloseTo(200, 0)
    })

    test("with drag(), points under the touches stay under them", async ({
        page,
    }) => {
        const spread = async (query: string) => {
            await open(page, query)
            await twoFinger(
                page,
                [
                    { x: 160, y: 150 },
                    { x: 190, y: 150 },
                ],
                [
                    { x: 145, y: 170 },
                    { x: 205, y: 170 },
                ],
                { steps: 10 }
            )
            return rect(page, "#box")
        }

        const withoutDrag = await spread("")
        const withDrag = await spread("?drag")

        // (175, 150) moved to (175, 170) and the box doubled around it.
        expect(withoutDrag.left).toBeCloseTo(25, 0)
        expect(withoutDrag.top).toBeCloseTo(70, 0)
        expect(withDrag.left).toBeCloseTo(withoutDrag.left, 0)
        expect(withDrag.top).toBeCloseTo(withoutDrag.top, 0)
        expect(withDrag.width).toBeCloseTo(200, 0)
    })

    test("with drag(), a touch that starts dragging can then pinch", async ({
        page,
    }) => {
        await open(page, "?drag")

        const cdp = await page.context().newCDPSession(page)
        // First touch drags 20px right...
        await touch(cdp, "touchStart", [{ x: 150, y: 150 }])
        await frames(page, 1)
        for (const x of [155, 160, 170]) {
            await touch(cdp, "touchMove", [{ x, y: 150 }])
            await frames(page, 1)
        }
        // ...then a second touch pinches 2x around the first.
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

        // The box (now 120-220) doubles around x = 170.
        const box = await rect(page, "#box")
        expect(box.width).toBeCloseTo(200, 0)
        expect(box.left).toBeCloseTo(170 - (170 - 120) * 2, 0)

        // Lifting the second touch hands back to drag without a jump.
        // (A touchEnd lists the touches that lift.)
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [{ x: 210, y: 150, id: 1 }],
        })
        await frames(page, 2)
        await touch(cdp, "touchMove", [{ x: 180, y: 150 }])
        await frames(page, 2)
        expect((await rect(page, "#box")).left).toBeCloseTo(box.left + 10, 0)
        await touch(cdp, "touchEnd", [])
    })

    const spread2x = (page: Page) =>
        twoFinger(
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

    test("calls the start callback once per gesture, with the element and event", async ({
        page,
    }) => {
        await open(page)
        await spread2x(page)

        expect(await events(page)).toEqual(["start", "end:pointerup"])
        expect(await page.evaluate(() => (window as any).startArgs)).toEqual([
            { isBox: true, type: "pointerdown" },
        ])

        // A new gesture calls it again.
        await spread2x(page)
        expect(await events(page)).toEqual([
            "start",
            "end:pointerup",
            "start",
            "end:pointerup",
        ])
        expect((await rect(page, "#box")).width).toBeCloseTo(400, 0)
    })

    test("a returned function is called when the gesture ends", async ({
        page,
    }) => {
        await open(page, "?returns=function")
        await spread2x(page)

        expect(await events(page)).toEqual(["start", "end:pointerup"])
        const info = await page.evaluate(() => (window as any).lastInfo)
        expect(info.scale).toBeCloseTo(2, 1)
    })

    test("pinches when the start callback returns nothing", async ({
        page,
    }) => {
        await open(page, "?returns=none")
        await spread2x(page)

        expect(await events(page)).toEqual(["start"])
        expect((await rect(page, "#box")).width).toBeCloseTo(200, 0)
    })
})

test.describe("pinch with a trackpad", () => {
    test("ctrl + wheel zooms around the cursor", async ({ page }) => {
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

        await expect.poll(() => events(page)).toEqual(["start", "end:wheel"])
    })
})
