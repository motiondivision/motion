import { test, expect } from "@playwright/test"

test.describe("animateLayout shared elements", () => {
    test("shared elements should not fade in by default", async ({ page }) => {
        await page.goto(
            "http://localhost:8000/animate-layout/shared-element-no-crossfade.html"
        )

        // Wait for the test to complete
        await page.waitForTimeout(500)

        // Check that no elements have data-layout-correct="false"
        const incorrectElements = await page.locator(
            '[data-layout-correct="false"]'
        )
        await expect(incorrectElements).toHaveCount(0)
    })
})
