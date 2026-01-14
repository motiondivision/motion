import { test, expect } from "@playwright/test"

test.describe("animateLayout", () => {
    test("repeat-animation: subsequent animations should animate, not happen instantly", async ({
        page,
    }) => {
        // Change base URL for this test
        await page.goto("http://localhost:8000/animate-layout/repeat-animation.html")

        // Wait for the test to complete
        await page.waitForTimeout(500)

        // Check that no elements have data-layout-correct="false"
        const incorrectElements = await page.locator(
            '[data-layout-correct="false"]'
        )
        await expect(incorrectElements).toHaveCount(0)
    })
})
