import { expect, Page, test } from "@playwright/test"
import { dragFromTo, events, frames, pressAndMove, rect } from "./drag-helpers"

/**
 * Vanilla equivalent of packages/framer-motion/cypress/integration/drag.ts
 * (non-layout half) and drag-release-before-frame.ts.
 *
 * The box is 50x50 and starts at the viewport origin, with the page
 * scrolled by 100px.
 */

const open = async (page: Page, query = "") => {
    await page.goto(`gestures/drag-basic.html${query}`)
    await frames(page, 2)
}

test.describe("drag: basic", () => {
    test("drags the element by the pointer distance", async ({ page }) => {
        await open(page)
        expect(await rect(page, "#box")).toMatchObject({ left: 0, top: 0 })

        await dragFromTo(page, { x: 5, y: 5 }, { x: 205, y: 305 })

        expect(await rect(page, "#box")).toMatchObject({ left: 200, top: 300 })
        expect(await events(page)).toEqual(["start", "end"])
        expect(
            await page.evaluate(() => (window as any).moves)
        ).toBeGreaterThan(0)
        expect(
            await page.evaluate(() => (window as any).dragEndOffset)
        ).toEqual({ x: 200, y: 300 })
    })

    test("drags when the gesture starts on a child", async ({ page }) => {
        await open(page, "?showChild=true")
        await dragFromTo(page, { x: 5, y: 5 }, { x: 205, y: 305 })
        expect(await rect(page, "#box")).toMatchObject({ left: 200, top: 300 })
        expect(await rect(page, "#child")).toMatchObject({
            left: 200,
            top: 300,
        })
    })

    test("drags from an initial offset set by animate()", async ({ page }) => {
        await open(page, "?x=100&y=100")
        expect(await rect(page, "#box")).toMatchObject({ left: 100, top: 100 })

        await dragFromTo(page, { x: 105, y: 105 }, { x: 305, y: 305 })

        expect(await rect(page, "#box")).toMatchObject({ left: 300, top: 300 })
    })

    /**
     * Known issue: animate() runs x/y as an accelerated transform group
     * bound to the element's style effect. drag() hands the values to a
     * VisualElement, but the finished group stays registered. When the
     * drag stops the values on release, the group cleans up and commits a
     * transform built from the released effect state (transform: none),
     * so the element jumps back to its origin while x is still 300.
     */
    test("drags from an offset animated before drag() is attached", async ({
        page,
    }) => {
        test.fail()
        await open(page, "?x=100&y=100&offset=before&duration=0.1")
        await expect.poll(async () => (await rect(page, "#box")).left).toBe(100)

        await dragFromTo(page, { x: 105, y: 105 }, { x: 305, y: 305 })

        expect(await rect(page, "#box")).toMatchObject({ left: 300, top: 300 })
    })

    /**
     * Known issue: an instant animate() whose values are handed to drag()'s
     * VisualElement commits its final value after that frame's render, and
     * VisualElement.scheduleRender ignores a second request with the same
     * frame timestamp. latestValues holds x: 100 but the element is left
     * rendered at transform: none.
     */
    test("renders an instant animate() offset set before drag() is attached", async ({
        page,
    }) => {
        test.fail()
        await open(page, "?x=100&y=100&offset=before")
        await frames(page, 5)
        expect(await rect(page, "#box")).toMatchObject({ left: 100, top: 100 })
    })

    test("drags from a percentage initial offset", async ({ page }) => {
        // 200% of a 50px box = 100px
        await open(page, "?x=200&y=200&percentage=true")
        expect(await rect(page, "#box")).toMatchObject({ left: 100, top: 100 })

        await dragFromTo(page, { x: 105, y: 105 }, { x: 305, y: 305 })

        expect(await rect(page, "#box")).toMatchObject({ left: 300, top: 300 })
    })

    test("locks drag to x", async ({ page }) => {
        await open(page, "?axis=x")
        await dragFromTo(page, { x: 5, y: 5 }, { x: 205, y: 305 })
        expect(await rect(page, "#box")).toMatchObject({ left: 200, top: 0 })
    })

    test("locks drag to y", async ({ page }) => {
        await open(page, "?axis=y")
        await dragFromTo(page, { x: 5, y: 5 }, { x: 205, y: 305 })
        expect(await rect(page, "#box")).toMatchObject({ left: 0, top: 300 })
    })

    test("direction locks to y", async ({ page }) => {
        await open(page, "?lock=true")

        // First movement is vertical, so the gesture locks to y
        await pressAndMove(page, { x: 5, y: 5 }, { x: 5, y: 205 })
        await page.mouse.move(205, 205, { steps: 5 })
        await frames(page, 1)
        await page.mouse.up()
        await frames(page, 2)

        expect(await rect(page, "#box")).toMatchObject({ left: 0, top: 200 })
        expect(await events(page)).toEqual(["start", "lock-y", "end"])
    })

    test("direction locks to x", async ({ page }) => {
        await open(page, "?lock=true")

        await pressAndMove(page, { x: 5, y: 5 }, { x: 205, y: 5 })
        await page.mouse.move(205, 205, { steps: 5 })
        await frames(page, 1)
        await page.mouse.up()
        await frames(page, 2)

        expect(await rect(page, "#box")).toMatchObject({ left: 200, top: 0 })
        expect(await events(page)).toEqual(["start", "lock-x", "end"])
    })

    test("constraints as object: bottom right", async ({ page }) => {
        await open(page, "?right=100&bottom=100")
        await dragFromTo(page, { x: 5, y: 5 }, { x: 305, y: 305 })
        expect(await rect(page, "#box")).toMatchObject({ left: 100, top: 100 })
    })

    test("constraints as object: top left", async ({ page }) => {
        await open(page, "?left=-10&top=-10")
        await dragFromTo(page, { x: 40, y: 40 }, { x: 10, y: 10 })
        expect(await rect(page, "#box")).toMatchObject({ left: -10, top: -10 })
    })

    for (const [param, expected] of [
        ["true", { left: 0, top: 0 }],
        ["x", { left: 0, top: -10 }],
        ["y", { left: -10, top: 0 }],
    ] as const) {
        test(`snapToOrigin: ${param}`, async ({ page }) => {
            await open(page, `?return=${param}&left=-10&top=-10`)

            await pressAndMove(page, { x: 40, y: 40 }, { x: 10, y: 10 })
            expect(await rect(page, "#box")).toMatchObject({
                left: -10,
                top: -10,
            })

            await page.mouse.up()

            await expect
                .poll(async () => {
                    const { left, top } = await rect(page, "#box")
                    return { left, top }
                })
                .toEqual(expected)
        })
    }

    test("returned cleanup stops the gesture", async ({ page }) => {
        await open(page)
        await page.evaluate(() => (window as any).stopDrag())
        await dragFromTo(page, { x: 5, y: 5 }, { x: 205, y: 305 })
        expect(await rect(page, "#box")).toMatchObject({ left: 0, top: 0 })
        expect(await events(page)).toEqual([])
    })
})

/**
 * Browsers flush a pending (coalesced) pointermove right before pointerup,
 * so the final move and the release often arrive in the same frame. The
 * events are dispatched synthetically so they're guaranteed to share a
 * frame.
 */
test.describe("drag: release before the next frame", () => {
    const dispatch = (page: Page, events: [string, number, number][]) =>
        page.evaluate((list) => {
            const el = document.getElementById("box")!
            for (const [type, clientX, clientY] of list) {
                el.dispatchEvent(
                    new PointerEvent(type, {
                        clientX,
                        clientY,
                        isPrimary: true,
                        bubbles: true,
                        pointerId: 1,
                        button: 0,
                        pointerType: "mouse",
                    })
                )
            }
        }, events)

    const start = async (page: Page) => {
        await open(page)
        await dispatch(page, [
            ["pointerdown", 5, 5],
            ["pointermove", 15, 15],
        ])
        await frames(page, 2)
        expect(await rect(page, "#box")).toMatchObject({ left: 10, top: 10 })
    }

    const expectRestingAt = async (page: Page, x: number, y: number) => {
        await frames(page, 2)
        expect(
            await page.evaluate(() => (window as any).dragEndOffset)
        ).toEqual({ x, y })
        expect(await rect(page, "#box")).toMatchObject({ left: x, top: y })
    }

    test("applies a pointermove followed by pointerup in the same frame", async ({
        page,
    }) => {
        await start(page)
        await dispatch(page, [
            ["pointermove", 105, 105],
            ["pointerup", 105, 105],
        ])
        await expectRestingAt(page, 100, 100)
    })

    test("applies a pointermove when a frame runs before pointerup", async ({
        page,
    }) => {
        await start(page)
        await dispatch(page, [["pointermove", 105, 105]])
        await frames(page, 1)
        await dispatch(page, [["pointerup", 105, 105]])
        await expectRestingAt(page, 100, 100)
    })
})

/**
 * Touch input needs touch-action set on the draggable, otherwise the
 * browser pans the page and cancels the pointer after a few pixels. React
 * sets it (with user-select and draggable) from the drag prop; drag() must
 * do the same.
 */
test.describe("drag: touch", () => {
    test.use({ hasTouch: true, isMobile: true })

    const touchDrag = async (page: Page, dx: number, dy: number) => {
        const cdp = await page.context().newCDPSession(page)
        const touch = (type: string, x = 0, y = 0) =>
            cdp.send("Input.dispatchTouchEvent", {
                type: type as "touchStart",
                touchPoints: type === "touchEnd" ? [] : [{ x, y }],
            })
        await touch("touchStart", 25, 25)
        for (let i = 1; i <= 10; i++) {
            await touch("touchMove", 25 + (dx * i) / 10, 25 + (dy * i) / 10)
            await frames(page, 1)
        }
        await touch("touchEnd")
        await frames(page, 2)
    }

    test("drags with touch without scrolling the page", async ({ page }) => {
        await open(page)
        await touchDrag(page, 100, 150)
        expect(await rect(page, "#box")).toMatchObject({ left: 100, top: 150 })
        expect(await page.evaluate(() => window.scrollY)).toBe(100)
        expect(await events(page)).toEqual(["start", "end"])
    })

    test("sets the same element styles as React drag", async ({ page }) => {
        const read = () =>
            page.locator("#box").evaluate((el) => {
                const style = getComputedStyle(el)
                return {
                    touchAction: style.touchAction,
                    userSelect: style.userSelect,
                    draggable: (el as HTMLElement).draggable,
                }
            })

        await open(page)
        expect(await read()).toEqual({
            touchAction: "none",
            userSelect: "none",
            draggable: false,
        })

        await open(page, "?axis=x")
        expect((await read()).touchAction).toBe("pan-y")

        await open(page, "?axis=y")
        expect((await read()).touchAction).toBe("pan-x")

        // Cleanup restores the element
        await page.evaluate(() => (window as any).stopDrag())
        expect(await read()).toEqual({
            touchAction: "auto",
            userSelect: "auto",
            draggable: false,
        })
    })
})
