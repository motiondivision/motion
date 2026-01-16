import { test, expect } from "@playwright/test"

test.describe("animateLayout shared elements A-AB-A", () => {
    test("crossfade works for A -> AB -> A pattern", async ({ page }) => {
        // Capture console errors
        const errors: string[] = []
        page.on('console', msg => {
            errors.push(`[${msg.type()}] ${msg.text()}`)
        })

        await page.goto(
            "http://localhost:8000/animate-layout/shared-element-a-ab-a.html"
        )

        // Wait for the test to complete
        await page.waitForTimeout(2000)

        // Log all console messages for debugging
        console.log('All console:', errors)

        // Also get error messages from the page
        const pageErrors = await page.locator('p').allTextContents()
        if (pageErrors.length > 0) {
            console.log('Page errors:', pageErrors)
        }

        // Check that no elements have data-layout-correct="false"
        const incorrectElements = await page.locator(
            '[data-layout-correct="false"]'
        )
        await expect(incorrectElements).toHaveCount(0)
    })
})
