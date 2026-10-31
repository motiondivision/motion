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
