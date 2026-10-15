import { expect, Page, test } from "@playwright/test"
import { frames, pressAndMove, rect } from "./drag-helpers"

/**
 * Vanilla equivalent of
 * packages/framer-motion/cypress/integration/drag-scroll-while-drag.ts.
 *
 * The draggable is 100x100 at (50, 50). Each test grabs it at its centre
 * and drags it by (45, 45), so it rests at (95, 95) under the pointer.
 */

const open = async (page: Page, query = "") => {
    await page.goto(`gestures/drag-scroll.html${query}`)
    await frames(page, 2)
}

const grab = async (page: Page) => {
    expect(await rect(page, "#draggable")).toMatchObject({ left: 50, top: 50 })
    await pressAndMove(page, { x: 100, y: 100 }, { x: 145, y: 145 })
    expect(await rect(page, "#draggable")).toMatchObject({ left: 95, top: 95 })
}

const scrollContainer = (page: Page, top: number) =>
    page.evaluate((top) => {
        document.getElementById("scrollable")!.scrollTop = top
    }, top)

const scrollWindow = (page: Page, top: number) =>
    page.evaluate((top) => window.scrollTo(0, top), top)

for (const target of ["overflow ancestor", "window"] as const) {
    const query = target === "window" ? "?window=true" : ""
    const scroll = target === "window" ? scrollWindow : scrollContainer

    test.describe(`drag: scrolling the ${target} during drag`, () => {
        test("keeps the element under a stationary pointer", async ({
            page,
        }) => {
            await open(page, query)
            await grab(page)

            await scroll(page, 100)
            await frames(page, 3)
            const { left, top } = await rect(page, "#draggable")
            expect(left).toBeCloseTo(95, 0)
            expect(top).toBeCloseTo(95, 0)

            await page.mouse.up()
            await frames(page, 2)
            expect((await rect(page, "#draggable")).top).toBeCloseTo(95, 0)
        })

        test("keeps following the pointer after the scroll", async ({
            page,
        }) => {
            await open(page, query)
            await grab(page)

            await scroll(page, 200)
            await frames(page, 2)

            await page.mouse.move(195, 175, { steps: 5 })
            await frames(page, 1)
            await page.mouse.up()
            await frames(page, 2)

            const { left, top } = await rect(page, "#draggable")
            expect(left).toBeCloseTo(145, 0)
            expect(top).toBeCloseTo(125, 0)
        })

        test("keeps the element under the pointer during wheel scrolling", async ({
            page,
        }) => {
            await open(page, query)
            await grab(page)

            await page.mouse.wheel(0, 120)
            await expect
                .poll(() =>
                    page.evaluate(
                        (isWindow) =>
                            isWindow
                                ? window.scrollY
                                : document.getElementById("scrollable")!
                                      .scrollTop,
                        target === "window"
                    )
                )
                .toBeGreaterThan(0)
            await frames(page, 3)

            expect((await rect(page, "#draggable")).top).toBeCloseTo(95, 0)
            await page.mouse.up()
        })
    })
}

test("drag: moves correctly without scrolling", async ({ page }) => {
    await open(page)
    await grab(page)
    await page.mouse.up()
    await frames(page, 2)
    expect(await rect(page, "#draggable")).toMatchObject({ left: 95, top: 95 })
})
