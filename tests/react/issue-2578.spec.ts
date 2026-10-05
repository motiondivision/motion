import { expect, test } from "@playwright/test"

/**
 * #2578 — a MotionValue rendered as the child of an SVG <motion.text>
 * doesn't update the text content. The SVG renderer scrapes every
 * MotionValue prop as an attribute, `children` included, so the value is
 * written to a `children="..."` attribute on the element.
 */
test.describe("Issue #2578", () => {
    test("motion.text renders MotionValue child updates", async ({ page }) => {
        await page.goto("?test=issue-2578")
        await expect(page.locator("#svg-text")).toHaveText("0")

        await page.click("#set")
        await page.waitForTimeout(100)

        expect(await page.locator("#html-text").textContent()).toBe("100")
        expect(await page.locator("#svg-text").textContent()).toBe("100")
        expect(
            await page.locator("#svg-text").getAttribute("children")
        ).toBeNull()
    })
})
