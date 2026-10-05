import { expect, test } from "@playwright/test"

test.describe("issue #2263: motion component ref changes", () => {
    test("a new ref object receives the DOM element after re-render", async ({
        page,
    }) => {
        await page.goto("/?test=issue-2263")
        const result = page.locator("#result")
        await expect(result).toHaveText("bound")

        await page.click("#refresh")
        await expect(result).toHaveAttribute("data-count", "1")
        await expect(result).toHaveText("bound")

        await page.click("#refresh")
        await expect(result).toHaveAttribute("data-count", "2")
        await expect(result).toHaveText("bound")
    })
})
