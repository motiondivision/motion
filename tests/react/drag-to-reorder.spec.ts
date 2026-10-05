/**
 * Playwright mirror of the key assertions in
 * packages/framer-motion/cypress/integration/drag-to-reorder.ts — the dragged
 * item tracks the pointer, siblings swap, and the item snaps back to its new
 * slot on release.
 */
import { expect, Page, test } from "@playwright/test"

const box = (page: Page, id: string) =>
    page.evaluate((i) => {
        const { top, left, height, width } = document
            .getElementById(i)!
            .getBoundingClientRect()
        return { top, left, height, width }
    }, id)

test("drag to reorder, y axis", async ({ page }) => {
    await page.goto("?test=drag-to-reorder")
    await expect(page.locator("#Tomato")).toBeVisible()
    await page.waitForTimeout(100)

    const tomatoStart = await box(page, "#Tomato".slice(1))
    const cucumberStart = await box(page, "Cucumber")
    expect(cucumberStart.top).toBeGreaterThan(tomatoStart.top)

    await page.mouse.move(520, tomatoStart.top + 10)
    await page.mouse.down()
    await page.mouse.move(520, tomatoStart.top + 15, { steps: 2 })
    await page.waitForTimeout(50)
    await page.mouse.move(520, tomatoStart.top + 35, { steps: 3 })
    await page.waitForTimeout(50)
    await page.mouse.move(520, tomatoStart.top + 55, { steps: 3 })
    await page.waitForTimeout(150)

    // Dragged item follows the pointer (offset by the grab point)
    const tomatoMid = await box(page, "Tomato")
    expect(Math.abs(tomatoMid.top - (tomatoStart.top + 45))).toBeLessThan(25)

    // Cucumber has swapped into Tomato's original slot
    const cucumberMid = await box(page, "Cucumber")
    expect(Math.abs(cucumberMid.top - tomatoStart.top)).toBeLessThan(5)

    await page.mouse.up()
    await page.waitForTimeout(300)

    // Tomato settles into the second slot
    const tomatoEnd = await box(page, "Tomato")
    expect(Math.abs(tomatoEnd.top - cucumberStart.top)).toBeLessThan(6)
    const cucumberEnd = await box(page, "Cucumber")
    expect(Math.abs(cucumberEnd.top - tomatoStart.top)).toBeLessThan(5)
})
