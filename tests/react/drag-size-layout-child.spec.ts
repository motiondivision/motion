/**
 * When a dragged element changes position, its `layout`
 * children must move with it rather than animate from their old position.
 * layout="size" rewrites the parent's snapshot position before children are
 * notified, and a parent without `layout` has no snapshot at all, so the
 * parent's layout change must be detected regardless.
 */
import { expect, test } from "@playwright/test"

for (const parentLayout of [true, false]) {
    test(`layout child moves with a dragged parent (layout=${
        parentLayout ? "size" : "none"
    })`, async ({ page }) => {
        await page.goto(
            `?test=drag-size-layout-child&parentLayout=${parentLayout}`
        )
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
}
