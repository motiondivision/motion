import { expect, test } from "@playwright/test"

/**
 * #2579 — useInView never observes an element whose ref attaches after the
 * first render (the component renders null first).
 */
test.describe("Issue #2579", () => {
    test("useInView observes an element rendered after mount", async ({
        page,
    }) => {
        await page.goto("?test=issue-2579")
        await expect(page.locator("#in-view")).toHaveText("false")

        await page.click("#show")
        await expect(page.locator("#box")).toBeVisible()

        await expect(page.locator("#in-view")).toHaveText("true", {
            timeout: 2000,
        })
    })
})
