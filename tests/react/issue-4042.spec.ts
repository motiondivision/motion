/**
 * https://github.com/motiondivision/motion/issues/4042
 *
 * An open card shares a layoutId with a gallery item, and its nested child
 * shares a layoutId with the item's nested child. Switching the open card to
 * another item's layoutIds, then closing it, must still let AnimatePresence
 * remove the card once its 1s exit is done.
 */
import { expect, Page, test } from "@playwright/test"

const box = (page: Page, selector: string) =>
    page.locator(selector).evaluate((element) => {
        const { x, y, width, height } = element.getBoundingClientRect()
        return { x, y, width, height }
    })

for (const switchItem of [true, false]) {
    test(`card exits ${
        switchItem ? "after switching to another item" : "without switching"
    }`, async ({ page }) => {
        const errors: string[] = []
        page.on("pageerror", (error) => errors.push(error.message))

        await page.goto("?test=issue-4042")
        await expect(page.locator("#red")).toBeVisible()
        const redDot = await box(page, "#dot-red")

        await page.click("#red")
        await page.waitForTimeout(1500)

        if (switchItem) {
            await page.click("#blue", { force: true })

            // The red item's dot animates home from the card's dot
            await page.waitForTimeout(300)
            const midway = await box(page, "#dot-red")
            expect(midway.x).toBeGreaterThan(redDot.x + 20)
            expect(midway.y).toBeGreaterThan(redDot.y + 20)

            await page.waitForTimeout(1200)
            expect(await box(page, "#dot-red")).toEqual(redDot)
        }

        await page.click("#close", { force: true })
        await expect(page.locator("#card")).toHaveCount(0, { timeout: 2500 })
        expect(errors).toEqual([])
    })
}
