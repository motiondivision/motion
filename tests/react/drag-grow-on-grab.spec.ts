/**
 * A dragged element without `layout` that changes size on drag start should
 * follow the pointer from its left edge, not jump to keep its centre.
 */
import { expect, test } from "@playwright/test"

test("element without layout grows from where it was grabbed", async ({
    page,
}) => {
    await page.goto("?test=drag-grow-on-grab")
    await expect(page.locator("#box")).toBeVisible()
    await page.waitForTimeout(200)

    await page.mouse.move(150, 150)
    await page.mouse.down()
    await page.mouse.move(160, 160, { steps: 5 })
    await page.mouse.move(170, 170, { steps: 5 })
    await page.waitForTimeout(300)

    const box = await page.evaluate(() =>
        document.getElementById("box")!.getBoundingClientRect().toJSON()
    )
    await page.mouse.up()

    expect(box.width).toBeCloseTo(300, 0)
    expect(box.left).toBeCloseTo(120, 0)
})
