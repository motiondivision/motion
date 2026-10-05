/**
 * https://github.com/motiondivision/motion/issues/1630
 *
 * A child with `layout` inside a draggable parent should still perform its
 * layout animation when its layout changes while the parent is being dragged.
 * The handle moves from the left to the right of a 400px wide switch over a
 * 10s linear transition, so ~1s in it should be only slightly offset from
 * the switch's left edge, rather than snapping straight to the right edge.
 */
import { expect, Page, test } from "@playwright/test"

async function handleOffsetAfterToggle(page: Page, drag: boolean) {
    await page.goto(`?test=issue-1630&drag=${drag}`)
    await expect(page.locator("#handle")).toBeVisible()
    await page.waitForTimeout(200)

    // Start dragging the switch (grab its empty middle area)
    await page.mouse.move(300, 150)
    await page.mouse.down()
    await page.mouse.move(310, 160, { steps: 5 })
    await page.mouse.move(320, 170, { steps: 5 })
    await page.waitForTimeout(100)

    // Toggle the switch mid-drag
    await page.keyboard.press("t")
    await page.waitForTimeout(1000)

    // Single point-in-time read
    const offset = await page.evaluate(() => {
        const s = document.getElementById("switch")!.getBoundingClientRect()
        const h = document.getElementById("handle")!.getBoundingClientRect()
        return h.left - s.left
    })
    await page.mouse.up()
    return offset
}

test.describe("issue #1630: layout animation while parent is dragged", () => {
    test("control: child layout animates when parent is not draggable", async ({
        page,
    }) => {
        const offset = await handleOffsetAfterToggle(page, false)
        expect(offset).toBeLessThan(150)
    })

    test("child layout animates while parent is being dragged", async ({
        page,
    }) => {
        const offset = await handleOffsetAfterToggle(page, true)
        expect(offset).toBeLessThan(150)
    })
})
