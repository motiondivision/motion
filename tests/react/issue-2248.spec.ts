import { expect, Page, test } from "@playwright/test"

/**
 * #2248: a layout change triggered from onDrag (while the pointer is still
 * down) should animate the card back into its slot, exactly like the same
 * change triggered from onDragEnd.
 */
async function dragOpenCardDown(page: Page, id: number) {
    await page.click(`#card-${id}`)
    await page.waitForTimeout(1500)

    const box = (await page.locator(`#card-${id}`).boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + 50

    await page.mouse.move(x, y)
    await page.mouse.down()
    for (let i = 1; i <= 15; i++) {
        await page.mouse.move(x, y + i * 10)
        await page.waitForTimeout(16)
    }
    await page.waitForTimeout(200)
    await page.mouse.up()
    await page.waitForTimeout(2000)
}

for (const [id, handler] of [
    [0, "onDragEnd"],
    [1, "onDrag"],
] as const) {
    test(`card closed from ${handler} returns to its slot`, async ({
        page,
    }) => {
        await page.goto("/?test=issue-2248")
        const slot = (await page.locator(`#slot-${id}`).boundingBox())!

        await dragOpenCardDown(page, id)

        const card = page.locator(`#card-${id}`)
        await expect(card).toHaveAttribute("data-selected", "false")

        const box = (await card.boundingBox())!
        expect(Math.round(box.x)).toBe(Math.round(slot.x))
        expect(Math.round(box.y)).toBe(Math.round(slot.y))
        expect(Math.round(box.width)).toBe(Math.round(slot.width))
        expect(Math.round(box.height)).toBe(Math.round(slot.height))
    })
}
