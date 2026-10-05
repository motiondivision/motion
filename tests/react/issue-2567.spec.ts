import { expect, Page, test } from "@playwright/test"

/**
 * #2567 — items mounted with layout={false} don't layout animate after the
 * layout prop changes to true; items mounted with layout={true} do.
 */
function top(page: Page, id: string) {
    return page.evaluate(
        (elementId) =>
            document.getElementById(elementId)!.getBoundingClientRect().top,
        id
    )
}

test.describe("Issue #2567", () => {
    test("layout animates after layout changes from false to true", async ({
        page,
    }) => {
        await page.goto("?test=issue-2567")
        await expect(page.locator("#item-0")).toBeVisible()

        await page.click("#toggle")
        await expect(page.locator("#layout-state")).toHaveText("true")
        await page.waitForTimeout(100)

        const before = await top(page, "item-0")

        // Prepending an item pushes item-0 down by 110px. With a 10s linear
        // layout transition it should still be near its old position.
        await page.click("#add")
        await expect(page.locator("#item-2")).toBeVisible()
        await page.waitForTimeout(500)

        const after = await top(page, "item-0")
        expect(after - before).toBeLessThan(55)
    })

    test("control: items mounted with layout={true} animate", async ({
        page,
    }) => {
        await page.goto("?test=issue-2567")
        await page.click("#toggle")
        await page.click("#add")
        await expect(page.locator("#item-2")).toBeVisible()
        await page.waitForTimeout(100)

        const before = await top(page, "item-2")
        await page.click("#add")
        await expect(page.locator("#item-3")).toBeVisible()
        await page.waitForTimeout(500)

        const after = await top(page, "item-2")
        expect(after - before).toBeLessThan(55)
    })
})
