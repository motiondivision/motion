import { expect, test } from "@playwright/test"

/**
 * #2538 — AnimatePresence's onExitComplete fires before the exiting child
 * has unmounted, so the child's effect cleanup runs after it.
 */
test.describe("Issue #2538", () => {
    test("onExitComplete fires after the exiting child unmounts", async ({
        page,
    }) => {
        await page.goto("?test=issue-2538")
        await expect(page.locator("#child")).toBeVisible()

        await page.click("#toggle")
        await expect(page.locator("#child")).toHaveCount(0)
        await page.waitForFunction(() => (window as any).__log.length >= 2)

        const log = await page.evaluate(() => (window as any).__log)
        expect(log).toEqual(["cleanup", "exitComplete:unmounted"])
    })
})
