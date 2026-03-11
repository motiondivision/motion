import { expect, test } from "@playwright/test"

test.describe("animateLayout()", () => {
    test("shared element animation works when animate() is called before animateLayout()", async ({
        page,
    }) => {
        await page.goto("animate-layout/modal-open-after-animate.html")

        // Wait for the test script to run
        await page.waitForTimeout(500)

        // Check that no elements have data-layout-correct="false" (which would indicate test failure)
        const failedElements = await page
            .locator('[data-layout-correct="false"]')
            .count()
        expect(failedElements).toBe(0)
    })

    test("original modal-open test still works", async ({ page }) => {
        await page.goto("animate-layout/modal-open.html")

        // Wait for the test script to run
        await page.waitForTimeout(500)

        // Check that no elements have data-layout-correct="false"
        const failedElements = await page
            .locator('[data-layout-correct="false"]')
            .count()
        expect(failedElements).toBe(0)
    })
})
