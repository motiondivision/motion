import { expect, test } from "@playwright/test"

test.describe("view", () => {
    test("can pause and set time", async ({ page }) => {
        // CI  isn't configured for snapshot testing
        if (process.env.CI) {
            test.skip()
        }
        await page.goto("animate/view-pause.html")
        await page.waitForTimeout(200)
        await expect(page).toHaveScreenshot()
    })
})
