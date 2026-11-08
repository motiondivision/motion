import { CDPSession, expect, Page, test } from "@playwright/test"

/**
 * The pinch prop with real touches through CDP. The 100x100 box starts at
 * (100, 100). See dev/react/src/tests/pinch-while.tsx.
 */

type Touch = { x: number; y: number; id?: number }

const frames = (page: Page, count = 2) =>
    page.evaluate(
        (n) =>
            new Promise<void>((resolve) => {
                const tick = (i: number) =>
                    i <= 0 ? resolve() : requestAnimationFrame(() => tick(i - 1))
                tick(n)
            }),
        count
    )

const touch = (
    cdp: CDPSession,
    type: "touchStart" | "touchMove" | "touchEnd",
    points: Touch[]
) =>
    cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: points.map(({ x, y, id }, i) => ({ x, y, id: id ?? i })),
    })

const open = async (page: Page, query = "") => {
    await page.goto(`?test=pinch-while${query}`)
    await page.waitForSelector("#box")
    await frames(page, 2)
}

const style = (page: Page, selector: string, key: string) =>
    page.$eval(
        selector,
        (el, key) => getComputedStyle(el).getPropertyValue(key),
        key
    )

const width = (page: Page) =>
    page.$eval("#box", (el) => el.getBoundingClientRect().width)

/**
 * Spread two touches around (150, 150) from 20px to 80px apart.
 */
async function spread(page: Page, cdp: CDPSession) {
    await touch(cdp, "touchStart", [
        { x: 140, y: 150 },
        { x: 160, y: 150 },
    ])
    await frames(page, 2)
    for (let i = 1; i <= 5; i++) {
        await touch(cdp, "touchMove", [
            { x: 140 - i * 6, y: 150 },
            { x: 160 + i * 6, y: 150 },
        ])
        await frames(page, 1)
    }
    await frames(page, 2)
}

test.describe("pinch prop", () => {
    test("whilePinch applies while pinching, on the box and its child", async ({
        page,
    }) => {
        await open(page)
        const cdp = await page.context().newCDPSession(page)

        await spread(page, cdp)
        expect(await width(page)).toBeCloseTo(400, 0)
        expect(await style(page, "#box", "opacity")).toBe("0.5")
        expect(await style(page, "#child", "opacity")).toBe("0.25")

        await touch(cdp, "touchEnd", [])
        await frames(page, 3)
        expect(await style(page, "#box", "opacity")).toBe("1")
        expect(await style(page, "#child", "opacity")).toBe("1")
    })

    test("a pinch isn't a tap, and whileTap ends with it", async ({
        page,
    }) => {
        await open(page)
        const cdp = await page.context().newCDPSession(page)

        await spread(page, cdp)
        expect(await style(page, "#box", "background-color")).toBe(
            "rgb(0, 0, 255)"
        )

        // The second touch lifts first, then the first.
        await touch(cdp, "touchEnd", [{ x: 110, y: 150, id: 0 }])
        await frames(page, 2)
        await touch(cdp, "touchEnd", [])
        await frames(page, 3)

        expect(await page.textContent("#taps")).toBe("0")
        expect(await style(page, "#box", "background-color")).toBe(
            "rgb(255, 0, 0)"
        )
    })

    test("a pinch isn't a tap when the first touch lifts first", async ({
        page,
    }) => {
        await open(page)
        const cdp = await page.context().newCDPSession(page)

        await spread(page, cdp)
        await touch(cdp, "touchEnd", [{ x: 190, y: 150, id: 1 }])
        await frames(page, 2)
        await touch(cdp, "touchEnd", [])
        await frames(page, 3)

        expect(await page.textContent("#taps")).toBe("0")
        expect(await style(page, "#box", "background-color")).toBe(
            "rgb(255, 0, 0)"
        )
    })

    test("a tap still taps", async ({ page }) => {
        await open(page)
        await page.click("#box")
        await frames(page, 2)
        expect(await page.textContent("#taps")).toBe("1")
    })

    test("a trackpad pinch zooms", async ({ page }) => {
        await open(page)
        await page.mouse.move(150, 150)
        await page.keyboard.down("Control")
        for (let i = 0; i < 5; i++) {
            await page.mouse.wheel(0, -20)
            await frames(page, 1)
        }
        await frames(page, 2)
        expect(await width(page)).toBeGreaterThan(150)
        expect(await style(page, "#box", "opacity")).toBe("0.5")
        await page.keyboard.up("Control")

        // The gesture ends once wheel events stop.
        await page.waitForTimeout(300)
        expect(await style(page, "#box", "opacity")).toBe("1")
    })

    test("drag's release velocity doesn't include the pinch", async ({
        page,
    }) => {
        await open(page, "&drag")
        const cdp = await page.context().newCDPSession(page)

        // Drag with the first touch, then zoom fast with both.
        await touch(cdp, "touchStart", [{ x: 120, y: 150 }])
        await frames(page, 1)
        await touch(cdp, "touchMove", [{ x: 130, y: 150 }])
        await frames(page, 2)
        await touch(cdp, "touchStart", [
            { x: 130, y: 150 },
            { x: 170, y: 150 },
        ])
        await frames(page, 2)
        for (let i = 1; i <= 5; i++) {
            await touch(cdp, "touchMove", [
                { x: 130 - i * 15, y: 150 },
                { x: 170 + i * 15, y: 150 },
            ])
            await frames(page, 1)
        }

        // The dragging touch moves on and lifts straight away.
        await touch(cdp, "touchMove", [
            { x: 40, y: 150 },
            { x: 245, y: 150 },
        ])
        await touch(cdp, "touchEnd", [{ x: 245, y: 150, id: 1 }])
        await frames(page, 2)
        await touch(cdp, "touchEnd", [])
        await frames(page, 3)

        const velocity = Number(await page.textContent("#velocity"))
        expect(Math.abs(velocity)).toBeLessThan(200)
    })
})
