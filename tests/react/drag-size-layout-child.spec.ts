/**
 * When a dragged element with layout="size" changes position, its `layout`
 * children must move with it rather than animate from their old position.
 * layout="size" rewrites the parent's snapshot position before children are
 * notified, so this guards against checking for a parent layout change after
 * that has happened.
 */
import { expect, test } from "@playwright/test"

test("layout child moves with a dragged layout=size parent", async ({
    page,
}) => {
    await page.goto("?test=drag-size-layout-child")
    await expect(page.locator("#child")).toBeVisible()
    await page.waitForTimeout(200)

    await page.mouse.move(250, 150)
    await page.mouse.down()
    await page.mouse.move(260, 160, { steps: 5 })
    await page.mouse.move(270, 170, { steps: 5 })
    await page.waitForTimeout(100)

    await page.keyboard.press("t")
    await page.waitForTimeout(500)

    const offset = await page.evaluate(() => {
        const p = document.getElementById("parent")!.getBoundingClientRect()
        const c = document.getElementById("child")!.getBoundingClientRect()
        return { x: c.left - p.left, y: c.top - p.top }
    })
    await page.mouse.up()

    expect(offset.x).toBeCloseTo(0, 0)
    expect(offset.y).toBeCloseTo(0, 0)
})
