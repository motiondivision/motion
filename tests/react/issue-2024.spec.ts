/**
 * https://github.com/motiondivision/motion/issues/2024
 *
 * Scroll a scrollable Reorder.Group, then drag a Reorder.Item that has
 * dragConstraints set. The item should follow the pointer (moved by the
 * pointer delta) and must not jump by the group's scroll offset.
 *
 * With ref constraints and scrollTop=200, current main moves the item ~65px UP
 * for a 20px pointer drag (the item's cached layout is stale by the group's
 * scroll offset, so the ref constraints are shifted). scrollTop=0, object
 * constraints and no constraints behave correctly and act as controls.
 */
import { expect, test } from "@playwright/test"

// [constraints, group scrollTop, item index] - the item is always ~140-150px
// from the top of the group's visible area so a 20px drag stays in bounds.
for (const [constraints, SCROLL, index] of [
    ["ref", 0, 2],
    ["none", 200, 5],
    ["object", 200, 5],
    ["ref", 200, 5],
] as const) {
    test(`issue #2024: constraints=${constraints} scrollTop=${SCROLL} - dragged item follows the pointer`, async ({
        page,
    }) => {
        await page.goto(`?test=issue-2024&constraints=${constraints}`)
        const item = page.locator(`#item-${index}`)
        await expect(item).toBeVisible()
        await page.waitForTimeout(200)

        await page.evaluate((s) => {
            document.getElementById("group")!.scrollTop = s
        }, SCROLL)
        await page.waitForTimeout(200)

        const before = (await item.boundingBox())!
        const x = before.x + 50
        const y = before.y + 30

        await page.mouse.move(x, y)
        await page.mouse.down()
        // Small drag down, staying within the group's visible bounds
        await page.mouse.move(x, y + 5, { steps: 2 })
        await page.mouse.move(x, y + 20, { steps: 5 })
        await page.waitForTimeout(100)

        // Single-point read while dragging
        const during = (await item.boundingBox())!
        await page.mouse.up()

        const dy = during.y - before.y

        if (constraints === "object") {
            // { top: 0, bottom: 0 } with default elastic 0.5: item moves
            // less than the pointer but in the same direction, never by
            // the scroll offset.
            expect(dy).toBeGreaterThanOrEqual(0)
            expect(dy).toBeLessThanOrEqual(20)
        } else {
            // Item follows the pointer
            expect(Math.abs(dy - 20)).toBeLessThanOrEqual(2)
        }
    })
}
