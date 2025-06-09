import { expect, test } from "@playwright/test"

test.describe("attrEffect", () => {
    test("correctly sets data-* and aria-* attributes", async ({ page }) => {
        await page.goto("effects/attr.html")
        const element = page.locator("#test-html")
        const dataTest = await element.getAttribute("data-my-value")
        expect(dataTest).toBe("test")
        const ariaTest = await element.getAttribute("aria-my-value")
        expect(ariaTest).toBe("a11y")
    })

    test("correctly sets non-presentational attributes as camelCase", async ({
        page,
    }) => {
        await page.goto("effects/attr.html")
        const element = page.locator("#test-html")
        const contentEditable = await element.getAttribute("contentEditable")
        expect(contentEditable).toBe("true")
    })
})
