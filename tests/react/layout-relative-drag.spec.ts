/**
 * Playwright mirror of
 * packages/framer-motion/cypress/integration/layout-relative-drag.ts — a
 * `layout` child of a dragged `layout` parent must follow the parent exactly.
 */
import { expect, Page, test } from "@playwright/test"

const box = (page: Page, id: string) =>
    page.evaluate((i) => {
        const { top, left, width, height } = document
            .getElementById(i)!
            .getBoundingClientRect()
        return { top, left, width, height }
    }, id)

test("layout child follows dragged layout parent", async ({ page }) => {
    await page.goto("?test=layout-relative-drag")
    await expect(page.locator("#parent")).toBeVisible()
    await page.waitForTimeout(200)

    expect(await box(page, "parent")).toEqual({
        top: 0,
        left: 0,
        width: 200,
        height: 200,
    })
    expect(await box(page, "child")).toEqual({
        top: 0,
        left: 0,
        width: 100,
        height: 100,
    })

    await page.mouse.move(5, 5)
    await page.mouse.down()
    await page.mouse.move(10, 10, { steps: 2 })
    await page.waitForTimeout(50)
    await page.mouse.move(110, 110, { steps: 5 })
    await page.waitForTimeout(100)

    const parent = await box(page, "parent")
    const child = await box(page, "child")
    await page.mouse.up()

    expect(Math.abs(parent.top - 105)).toBeLessThan(6)
    expect(Math.abs(parent.left - 105)).toBeLessThan(6)
    expect(child.top).toBeCloseTo(parent.top, 0)
    expect(child.left).toBeCloseTo(parent.left, 0)
})
