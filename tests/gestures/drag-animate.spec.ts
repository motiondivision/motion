import { expect, Page, test } from "@playwright/test"
import {
    dispatchPointer,
    dragBy,
    events,
    frames,
    pressAndMove,
    rect,
} from "./drag-helpers"

/**
 * drag() shares x/y with animate() and animateLayout(). The 100x100 box
 * starts at (100, 100).
 */

const open = async (page: Page, query = "") => {
    await page.goto(`gestures/drag-animate.html${query}`)
    await frames(page, 2)
}

const position = async (page: Page) => {
    const { left, top } = await rect(page, "#box")
    return { left, top }
}

test.describe("drag: interop with animate()", () => {
    test("animate() moves the element after a drag", async ({ page }) => {
        await open(page)
        await dragBy(page, "#box", 150, 50)
        expect(await position(page)).toEqual({ left: 250, top: 150 })

        await page.evaluate(() => (window as any).animateBox({ x: 0, y: 0 }))
        await expect.poll(() => events(page)).toContain("animated")
        await frames(page, 2)
        expect(await position(page)).toEqual({ left: 100, top: 100 })

        // The next drag starts from where animate() left it
        await dragBy(page, "#box", 50, 50)
        expect(await position(page)).toEqual({ left: 150, top: 150 })

        await page.evaluate(() => (window as any).animateBox({ x: 300, y: 0 }))
        await expect
            .poll(() => events(page))
            .toEqual(["start", "end", "animated", "start", "end", "animated"])
        await frames(page, 2)
        expect(await position(page)).toEqual({ left: 400, top: 100 })

        await dragBy(page, "#box", 50, 50)
        expect(await position(page)).toEqual({ left: 450, top: 150 })
    })

    test("a drag stops an animate() in progress without a jump", async ({
        page,
    }) => {
        await open(page)
        // Don't return the promise, or evaluate() waits for it
        await page.evaluate(() => {
            ;(window as any).animateBox({ x: 400 }, 4)
        })
        await page.waitForTimeout(500)

        const box = await rect(page, "#box")
        expect(box.left).toBeGreaterThan(110)
        expect(box.left).toBeLessThan(500)

        // Grab the centre, so the moving box is still under the pointer
        const from = { x: box.left + 50, y: box.top + 50 }
        await pressAndMove(page, from, { x: from.x + 50, y: from.y })
        const grabbed = await rect(page, "#box")
        await page.mouse.up()
        await frames(page, 2)

        /**
         * From the press, the box follows the pointer. Allow a frame of
         * animation (~2px at 100px/s) between the press and the animation
         * being stopped.
         */
        const pressedLeft = await page.evaluate(
            () => (window as any).pressedLeft
        )
        expect(Math.abs(grabbed.left - pressedLeft - 50)).toBeLessThan(3)
        expect(await events(page)).toEqual(["start", "end"])

        // The animation is stopped
        await page.waitForTimeout(500)
        expect((await rect(page, "#box")).left).toBe(grabbed.left)
    })

    test("animate() takes over from momentum", async ({ page }) => {
        await open(page, "?momentum=true")

        // Throw the box right
        await dispatchPointer(page, "#box", "pointerdown", 150, 150)
        await dispatchPointer(page, "#box", "pointermove", 155, 150)
        await frames(page, 1)
        await page.waitForTimeout(50)
        await page.locator("#box").evaluate(
            (el) =>
                new Promise<void>((resolve) => {
                    const send = (type: string) =>
                        el.dispatchEvent(
                            new PointerEvent(type, {
                                clientX: 300,
                                clientY: 150,
                                pointerId: 1,
                                pointerType: "mouse",
                                isPrimary: true,
                                button: 0,
                                bubbles: true,
                            })
                        )
                    send("pointermove")
                    requestAnimationFrame(() => {
                        send("pointerup")
                        resolve()
                    })
                })
        )

        await page.waitForTimeout(50)
        const thrown = await position(page)
        expect(thrown.left).toBeGreaterThan(250)

        await page.evaluate(() => (window as any).animateBox({ x: 0 }))
        expect(await events(page)).toContain("animated")
        await page.waitForTimeout(300)
        expect(await position(page)).toEqual({ left: 100, top: 100 })
    })
})

test.describe("drag: interop with animateLayout()", () => {
    test("keeps the element under the pointer when its layout shifts during drag", async ({
        page,
    }) => {
        await open(page, "?layout=true")
        await pressAndMove(page, { x: 150, y: 150 }, { x: 200, y: 200 })
        expect(await position(page)).toEqual({ left: 150, top: 150 })

        await page.evaluate(() => (window as any).shiftLayout(100))
        await page.waitForTimeout(450)
        await page.mouse.move(201, 201)
        await frames(page, 2)

        const { left, top } = await position(page)
        expect(left).toBeCloseTo(151, 0)
        expect(top).toBeCloseTo(151, 0)

        await page.mouse.up()
        await frames(page, 2)
        expect((await position(page)).top).toBeCloseTo(151, 0)
    })

    test("keeps the drag offset through a layout animation after a drag", async ({
        page,
    }) => {
        await open(page, "?layout=true")
        await dragBy(page, "#box", 100, 100)
        expect(await position(page)).toEqual({ left: 200, top: 200 })

        await page.evaluate(() => (window as any).shiftLayout(100))
        await page.waitForTimeout(500)
        expect(await position(page)).toEqual({ left: 200, top: 300 })

        // And can be dragged again from there
        await dragBy(page, "#box", -50, -50)
        expect(await position(page)).toEqual({ left: 150, top: 250 })
    })
})
