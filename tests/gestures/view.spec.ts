import { expect, test } from "@playwright/test"

test.describe("view", () => {
    test("can pause and set time", async ({ page }) => {
        await page.goto("gestures/view-pause.html")
        await page.waitForTimeout(200)
        await expect(page).toHaveScreenshot()
    })
})
