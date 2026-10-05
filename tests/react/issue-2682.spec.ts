import { expect, Page, test } from "@playwright/test"

/**
 * #2682: whether a Reorder.Item's onClick fires after a drag depends on
 * the drag direction. Dragging the upper item down fires nothing, while
 * dragging the lower item up fires onClick.
 */
async function dragBy(page: Page, id: string, dy: number) {
    const box = (await page.locator(`#${id}`).boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++) {
        await page.mouse.move(x, y + (dy * i) / 10)
        await page.waitForTimeout(20)
    }
    await page.mouse.up()
    await page.waitForTimeout(500)
}

test.describe("Issue #2682", () => {
    test("onClick fires the same way whichever way an item is dragged", async ({
        page,
    }) => {
        await page.goto("?test=issue-2682")
        await page.waitForTimeout(200)

        // Drag the upper item below the lower item
        await dragBy(page, "a", 100)
        await expect(page.locator("#order")).toHaveText("b,a")
        const afterDown = await page.locator("#clicks").innerText()

        // Drag the (now) lower item back above the upper item
        await dragBy(page, "a", -100)
        await expect(page.locator("#order")).toHaveText("a,b")
        const afterUp = await page.locator("#clicks").innerText()

        expect(afterUp).toBe(afterDown)
    })
})
