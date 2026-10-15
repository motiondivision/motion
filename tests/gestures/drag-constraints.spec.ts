import { expect, Page, test } from "@playwright/test"
import {
    dispatchPointer,
    dragBy,
    dragFromTo,
    events,
    frames,
    pressAndMove,
    rect,
} from "./drag-helpers"

/**
 * Vanilla equivalents of the element ("ref") constraint Cypress specs:
 * drag.ts (ref constraints, resize, constraints return),
 * drag-ref-constraints-element-resize.ts,
 * drag-ref-constraints-resize-handle.ts and
 * drag-ref-constraints-absolute-scrolled.ts.
 */

const open = async (page: Page, query: string) => {
    await page.goto(`gestures/drag-constraints.html?${query}`)
    await frames(page, 2)
}

test.describe("drag: element constraints", () => {
    test("aren't reset while dragging by layout animations elsewhere", async ({
        page,
    }) => {
        await open(page, "case=sibling-layout")

        // x: "100%" of the 50px box, inside a 200x200 constraint at the
        // top of the (scrolled) viewport
        expect(await rect(page, "#box")).toMatchObject({ left: 50, top: 0 })

        await pressAndMove(page, { x: 75, y: 25 }, { x: 375, y: 325 })
        expect(await rect(page, "#box")).toMatchObject({ left: 150, top: 150 })

        // Hold while the sibling's layout animations remeasure the tree
        await page.waitForTimeout(450)
        await page.mouse.move(380, 330)
        await frames(page, 1)
        expect(await rect(page, "#box")).toMatchObject({ left: 150, top: 150 })

        await page.mouse.up()
        await frames(page, 2)
        expect(await rect(page, "#box")).toMatchObject({ left: 150, top: 150 })
    })

    test("rescale the element's position when the viewport resizes", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1000, height: 660 })
        await open(page, "case=viewport-resize")

        expect(await rect(page, "#constraints")).toMatchObject({
            left: 250,
            top: 0,
            right: 750,
            bottom: 300,
        })
        expect(await rect(page, "#box")).toMatchObject({
            left: 400,
            top: 50,
            right: 600,
            bottom: 250,
        })

        await dragFromTo(page, { x: 405, y: 55 }, { x: 605, y: 255 })
        expect(await rect(page, "#box")).toMatchObject({
            left: 550,
            top: 100,
            right: 750,
            bottom: 300,
        })

        await page.setViewportSize({ width: 800, height: 660 })
        await frames(page, 3)
        expect(await rect(page, "#constraints")).toMatchObject({
            left: 200,
            right: 600,
        })
        expect(await rect(page, "#box")).toMatchObject({
            left: 400,
            right: 600,
        })

        await page.setViewportSize({ width: 1000, height: 660 })
        await frames(page, 3)
        expect(await rect(page, "#box")).toMatchObject({
            left: 550,
            top: 100,
            right: 750,
            bottom: 300,
        })
    })

    test("constrain the element before it resizes", async ({ page }) => {
        await open(page, "case=element-resize")
        await dragBy(page, "#box", 600, 600, { x: 5, y: 5 })
        const { right, bottom } = await rect(page, "#box")
        expect(right).toBe(500)
        expect(bottom).toBe(500)
    })

    test("update when the draggable element resizes", async ({ page }) => {
        await open(page, "case=element-resize")
        await page.evaluate(() => (window as any).resizeBox())
        await frames(page, 3)
        expect(await rect(page, "#box")).toMatchObject({
            width: 300,
            height: 300,
        })

        await dragBy(page, "#box", 600, 600, { x: 5, y: 5 })
        const { right, bottom } = await rect(page, "#box")
        expect(right).toBeLessThanOrEqual(500)
        expect(bottom).toBeLessThanOrEqual(500)
        expect(right).toBeGreaterThan(498)
    })

    test("update when the draggable element resizes after a drag", async ({
        page,
    }) => {
        await open(page, "case=element-resize")
        await dragBy(page, "#box", 100, 100, { x: 5, y: 5 })
        expect(await rect(page, "#box")).toMatchObject({ left: 100, top: 100 })

        await page.evaluate(() => (window as any).resizeBox())
        await frames(page, 3)

        await dragBy(page, "#box", 600, 600, { x: 5, y: 5 })
        const { right, bottom } = await rect(page, "#box")
        expect(right).toBeLessThanOrEqual(500)
        expect(bottom).toBeLessThanOrEqual(500)
        expect(right).toBeGreaterThan(498)
    })

    test("update when the constraint element resizes", async ({ page }) => {
        await open(page, "case=element-resize")
        await page.evaluate(() => (window as any).resizeConstraints())
        await frames(page, 3)

        await dragBy(page, "#box", 600, 600, { x: 5, y: 5 })
        const { right, bottom } = await rect(page, "#box")
        expect(right).toBe(300)
        expect(bottom).toBe(300)
    })

    test("reach the visible bottom of an absolute constraint when the page was scrolled before drag()", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1000, height: 800 })
        await open(page, "case=absolute-scrolled&scroll=300")
        expect(await page.evaluate(() => window.scrollY)).toBe(300)

        // The box is above the viewport, so page.mouse can't reach it
        const box = await rect(page, "#box")
        expect(box.top).toBe(-300)
        await dispatchPointer(page, "#box", "pointerdown", 5, -295)
        await dispatchPointer(page, "#box", "pointermove", 10, -290)
        await frames(page, 1)
        await dispatchPointer(page, "#box", "pointermove", 1505, 1205)
        await frames(page, 1)
        await dispatchPointer(page, "#box", "pointerup", 1505, 1205)
        await frames(page, 2)

        // The constraint spans the initial containing block (1000x800 at
        // the document origin), so its visible part ends at y = 500
        const { bottom, right } = await rect(page, "#box")
        expect(bottom).toBeCloseTo(500, 0)
        expect(right).toBeCloseTo(1000, 0)
    })

    test("reach the visible bottom of an absolute constraint when the page is scrolled after drag()", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1000, height: 800 })
        await open(page, "case=absolute-scrolled&scroll=0")
        await page.evaluate(() => window.scrollTo(0, 300))
        await frames(page, 2)

        await dispatchPointer(page, "#box", "pointerdown", 5, -295)
        await dispatchPointer(page, "#box", "pointermove", 10, -290)
        await frames(page, 1)
        await dispatchPointer(page, "#box", "pointermove", 1505, 1205)
        await frames(page, 1)
        await dispatchPointer(page, "#box", "pointerup", 1505, 1205)
        await frames(page, 2)

        const { bottom, right } = await rect(page, "#box")
        expect(bottom).toBeCloseTo(500, 0)
        expect(right).toBeCloseTo(1000, 0)
    })

    test("onMeasureConstraints receives and can override the constraints", async ({
        page,
    }) => {
        await open(page, "case=return&override=true")
        await dragBy(page, "#box", 300, 300, { x: 50, y: 50 })
        expect(await page.evaluate(() => (window as any).measured)).toEqual({
            top: 0,
            left: 0,
            right: 200,
            bottom: 200,
        })
        expect(await rect(page, "#box")).toMatchObject({ left: 20, top: 20 })
    })
})

test.describe("drag: elastic constraints", () => {
    test("elastic: 0 stops at the constraint while dragging", async ({
        page,
    }) => {
        await open(page, "case=return&elastic=0")
        await pressAndMove(page, { x: 50, y: 50 }, { x: 450, y: 50 })
        expect((await rect(page, "#box")).left).toBe(200)
        await page.mouse.up()
    })

    test("elastic: 0.5 overshoots by half the distance, then returns", async ({
        page,
    }) => {
        await open(page, "case=return&elastic=0.5")
        await pressAndMove(page, { x: 50, y: 50 }, { x: 450, y: 50 })

        // 400px of pointer movement, 200px past the right constraint
        expect((await rect(page, "#box")).left).toBeCloseTo(300, 0)

        await page.mouse.up()
        await expect
            .poll(async () => (await rect(page, "#box")).left)
            .toBeCloseTo(200, 0)
        await expect.poll(() => events(page)).toContain("settled")
    })

    test("returns to constraints when released outside them", async ({
        page,
    }) => {
        await open(page, "case=return&elastic=1")
        await dragFromTo(page, { x: 50, y: 50 }, { x: 400, y: 400 })

        await expect
            .poll(async () => {
                const { right, bottom } = await rect(page, "#box")
                return right <= 302 && bottom <= 302
            })
            .toBe(true)
        const { left, top } = await rect(page, "#box")
        expect(left).toBeGreaterThanOrEqual(-2)
        expect(top).toBeGreaterThanOrEqual(-2)
    })

    test("returns to constraints when clicked during the return animation", async ({
        page,
    }) => {
        await open(page, "case=return&elastic=1")
        await dragFromTo(page, { x: 50, y: 50 }, { x: 400, y: 400 })

        // Click the element while it animates back
        await page.waitForTimeout(50)
        const box = await rect(page, "#box")
        await page.mouse.move(box.left + 50, box.top + 50)
        await page.mouse.down()
        await page.waitForTimeout(50)
        await page.mouse.up()

        await expect
            .poll(async () => {
                const { right, bottom } = await rect(page, "#box")
                return right <= 302 && bottom <= 302
            })
            .toBe(true)
    })

    test("doesn't jump when dragged again during the return animation", async ({
        page,
    }) => {
        await open(page, "case=return&elastic=1")
        await dragFromTo(page, { x: 50, y: 50 }, { x: 400, y: 400 })

        await page.waitForTimeout(50)
        const returning = await rect(page, "#box")
        expect(returning.right).toBeGreaterThan(302)
        expect(returning.bottom).toBeGreaterThan(302)

        // Grab and drag ~200px
        const from = { x: returning.left + 50, y: returning.top + 50 }
        await pressAndMove(page, from, { x: from.x + 200, y: from.y + 200 })

        // Release and measure on the very next frame
        const before = await rect(page, "#box")
        await page.mouse.up()
        await frames(page, 1)
        const after = await rect(page, "#box")
        expect(Math.abs(after.right - before.right)).toBeLessThan(30)
        expect(Math.abs(after.bottom - before.bottom)).toBeLessThan(30)
    })
})
