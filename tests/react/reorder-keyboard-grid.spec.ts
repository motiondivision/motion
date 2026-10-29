import { expect, Page, test } from "@playwright/test"

/**
 * In a grid, Up and Down move a grabbed item to the row above or below,
 * into the column it's in, not one place along the list.
 */
const order = (page: Page) => page.locator("#order").textContent()

test.describe("Reorder keyboard in a grid", () => {
    test("arrows move the item the way they point", async ({ page }) => {
        await page.goto("?test=reorder-keyboard-grid")
        await page.focus("#item-06")
        await page.keyboard.press(" ")

        /**
         * 01 02 03 04
         * 05 06 07 08
         * 09 10 11 12
         * 13 14
         */
        const steps: [string, string][] = [
            ["ArrowDown", "01,02,03,04,05,07,08,09,10,06,11,12,13,14"],
            // Into the short last row, by the column it's nearest
            ["ArrowDown", "01,02,03,04,05,07,08,09,10,11,12,13,14,06"],
            // Nothing below the last row
            ["ArrowDown", "01,02,03,04,05,07,08,09,10,11,12,13,14,06"],
            ["ArrowLeft", "01,02,03,04,05,07,08,09,10,11,12,13,06,14"],
            ["ArrowUp", "01,02,03,04,05,07,08,09,06,10,11,12,13,14"],
            ["ArrowUp", "01,02,03,04,06,05,07,08,09,10,11,12,13,14"],
            ["ArrowUp", "06,01,02,03,04,05,07,08,09,10,11,12,13,14"],
            // Nothing above the first row
            ["ArrowUp", "06,01,02,03,04,05,07,08,09,10,11,12,13,14"],
            ["ArrowRight", "01,06,02,03,04,05,07,08,09,10,11,12,13,14"],
        ]

        for (const [key, expected] of steps) {
            await page.keyboard.press(key)
            await expect.poll(() => order(page)).toBe(expected)
        }

        expect(await page.evaluate(() => document.activeElement?.id)).toBe(
            "item-06"
        )
    })
})
