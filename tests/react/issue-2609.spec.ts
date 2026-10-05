import { expect, test } from "@playwright/test"

/**
 * #2609: scaleZ isn't recognised as a transform, so it never makes it into
 * the element's transform (rotateZ and translateZ do).
 */
test.describe("Issue #2609", () => {
    test("scaleZ is applied to the transform", async ({ page }) => {
        await page.goto("?test=issue-2609")
        await page.waitForTimeout(200)

        const animated = await page
            .locator("#box")
            .evaluate((el) => (el as HTMLElement).style.transform)
        expect(animated).toContain("scaleZ(2)")

        const staticTransform = await page
            .locator("#static")
            .evaluate((el) => (el as HTMLElement).style.transform)
        expect(staticTransform).toContain("scaleZ(3)")
    })
})
