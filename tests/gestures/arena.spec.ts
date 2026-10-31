import { CDPSession, expect, Page, test } from "@playwright/test"
import { center, frames, pressAndMove } from "./drag-helpers"

const open = async (page: Page, query = "") => {
    await page.goto(`gestures/arena.html${query}`)
    await frames(page, 2)
}

const presses = (page: Page) => page.evaluate(() => (window as any).presses)
const phases = (page: Page) => page.evaluate(() => (window as any).phases)
const active = (page: Page) =>
    page.evaluate(() =>
        (window as any).MotionDOM.getGestures().map(
            (g: any) => g.kind + " " + g.phase
        )
    )

test.describe("gesture arena", () => {
    test("a click on the button taps", async ({ page }) => {
        await open(page)
        const { x, y } = await center(page, "#button")
        await page.mouse.click(x, y)
        await frames(page, 2)

        expect(await presses(page)).toEqual(["start", "tap"])
        expect(await active(page)).toEqual([])
    })

    test("dragging the card cancels the button's press before release", async ({
        page,
    }) => {
        await open(page)
        const from = await center(page, "#button")
        await pressAndMove(page, from, { x: from.x + 80, y: from.y })

        expect(await presses(page)).toEqual(["start", "cancel"])
        expect(await active(page)).toEqual(["drag active"])

        await page.mouse.up()
        await frames(page, 2)

        expect(await presses(page)).toEqual(["start", "cancel"])
        expect(await active(page)).toEqual([])
        expect(await phases(page)).toEqual([
            "press button possible",
            "drag parent possible",
            "drag parent active",
            "press button ended",
            "drag parent ended",
        ])
    })

    test("dragging the card holds its own press, then cancels it on release", async ({
        page,
    }) => {
        await open(page, "?same")
        const from = await center(page, "#parent")
        await pressAndMove(page, from, { x: from.x + 80, y: from.y })

        expect(await presses(page)).toEqual(["start"])
        expect((await active(page)).sort()).toEqual([
            "drag active",
            "press possible",
        ])

        await page.mouse.up()
        await frames(page, 2)

        expect(await presses(page)).toEqual(["start", "cancel"])
        expect(await active(page)).toEqual([])
    })

    test("touch: dragging the card cancels the button's press", async ({
        page,
        browserName,
    }) => {
        test.skip(browserName !== "chromium", "Touch input needs CDP")
        await open(page)
        const client: CDPSession = await page.context().newCDPSession(page)
        const touch = (type: string, x: number, y: number) =>
            client.send("Input.dispatchTouchEvent", {
                type,
                touchPoints: type === "touchEnd" ? [] : [{ x, y }],
            })

        const { x, y } = await center(page, "#button")
        await touch("touchStart", x, y)
        await frames(page, 1)
        for (let i = 1; i <= 8; i++) {
            await touch("touchMove", x + i * 10, y)
            await frames(page, 1)
        }

        expect(await presses(page)).toEqual(["start", "cancel"])
        expect(await active(page)).toEqual(["drag active"])

        await touch("touchEnd", x + 80, y)
        await frames(page, 2)

        expect(await active(page)).toEqual([])
    })
})

test.describe("drag after a hold", () => {
    const touchSession = async (page: Page) => {
        const client = await page.context().newCDPSession(page)
        return (type: string, x: number, y: number) =>
            client.send("Input.dispatchTouchEvent", {
                type,
                touchPoints: type === "touchEnd" ? [] : [{ x, y }],
            })
    }

    const itemTop = (page: Page) =>
        page.evaluate(
            () => document.getElementById("item")!.getBoundingClientRect().top
        )

    test("a quick touch swipe scrolls the page, not the item", async ({
        page,
        browserName,
    }) => {
        test.skip(browserName !== "chromium", "Touch input needs CDP")
        await page.goto("gestures/arena-after.html")
        await frames(page, 2)
        const touch = await touchSession(page)

        await touch("touchStart", 200, 300)
        for (let i = 1; i <= 10; i++) {
            await touch("touchMove", 200, 300 - i * 15)
            await frames(page, 1)
        }
        await touch("touchEnd", 200, 150)
        await frames(page, 4)

        const scrollY = await page.evaluate(() => window.scrollY)
        expect(scrollY).toBeGreaterThan(50)
        // The item only moved with the page
        expect(await itemTop(page)).toBeCloseTo(100 - scrollY, 0)
    })

    test("a touch held for `after` drags the item without scrolling", async ({
        page,
        browserName,
    }) => {
        test.skip(browserName !== "chromium", "Touch input needs CDP")
        await page.goto("gestures/arena-after.html")
        await frames(page, 2)
        const touch = await touchSession(page)

        await touch("touchStart", 200, 150)
        await page.waitForTimeout(400)
        await frames(page, 2)
        for (let i = 1; i <= 10; i++) {
            await touch("touchMove", 200, 150 + i * 10)
            await frames(page, 1)
        }

        expect(await page.evaluate(() => window.scrollY)).toBe(0)
        expect(await itemTop(page)).toBeGreaterThan(180)

        await touch("touchEnd", 200, 250)
        await frames(page, 2)
    })

    test("a mouse held for `after` drags the item", async ({ page }) => {
        await page.goto("gestures/arena-after.html")
        await frames(page, 2)

        await page.mouse.move(200, 150)
        await page.mouse.down()
        await page.waitForTimeout(400)
        await frames(page, 2)
        await page.mouse.move(200, 230, { steps: 5 })
        await frames(page, 2)

        expect(await itemTop(page)).toBeCloseTo(180, 0)
        await page.mouse.up()
    })

    test("a mouse moved before `after` doesn't drag", async ({ page }) => {
        await page.goto("gestures/arena-after.html")
        await frames(page, 2)

        await page.mouse.move(200, 150)
        await page.mouse.down()
        await page.mouse.move(200, 230, { steps: 5 })
        await page.waitForTimeout(400)
        await page.mouse.move(200, 260, { steps: 3 })
        await frames(page, 2)

        expect(await itemTop(page)).toBe(100)
        await page.mouse.up()
    })
})
