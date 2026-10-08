/**
 * Guards the behaviour Reorder relies on from the drag animation block
 * (see https://github.com/motiondivision/motion/issues/1630):
 *
 * 1. A `layout` child of a dragged `Reorder.Item` must move with the item when
 *    the order changes — it must not layout-animate the item's slot change.
 * 2. The dragged item itself must track the pointer, and its siblings must
 *    still swap places.
 */
import { expect, Page, test } from "@playwright/test"

const rect = (page: Page, id: string) =>
    page.evaluate(
        (i) => {
            const el = document.getElementById(i)!
            const { top, left, height } = el.getBoundingClientRect()
            return { top, left, height }
        },
        id
    )

test.describe("Reorder with layout children", () => {
    test("child stays locked to its dragged item across a reorder", async ({
        page,
    }) => {
        await page.goto("?test=reorder-layout-child")
        await expect(page.locator("#item-a")).toBeVisible()
        await page.waitForTimeout(200)

        const itemBefore = await rect(page, "item-a")
        const childBefore = await rect(page, "child-a")
        const offsetBefore = childBefore.top - itemBefore.top
        expect(offsetBefore).toBeLessThan(2)

        // Grab item "a" and drag it down past item "b" to trigger a reorder
        await page.mouse.move(150, 50)
        await page.mouse.down()
        await page.mouse.move(150, 60, { steps: 3 })
        await page.waitForTimeout(50)
        await page.mouse.move(150, 110, { steps: 5 })
        await page.waitForTimeout(50)
        await page.mouse.move(150, 160, { steps: 5 })
        await page.waitForTimeout(150)

        // The order must have changed
        const order = await page.evaluate(() =>
            Array.from(document.querySelectorAll("[id^='item-']")).map(
                (el) => el.id
            )
        )
        expect(order).toEqual(["item-b", "item-a", "item-c", "item-d"])

        // Mid-animation read: the child must still be flush with its item
        const item = await rect(page, "item-a")
        const child = await rect(page, "child-a")
        const grandchild = await rect(page, "grandchild-a")
        await page.mouse.up()

        expect(Math.abs(child.top - item.top)).toBeLessThan(5)
        expect(Math.abs(grandchild.top - item.top)).toBeLessThan(5)
        // And the item must be following the pointer, not sat in its slot
        expect(Math.abs(item.top - 110)).toBeLessThan(25)
    })

    test("siblings animate to their new slots", async ({ page }) => {
        await page.goto("?test=reorder-layout-child")
        await expect(page.locator("#item-a")).toBeVisible()
        await page.waitForTimeout(200)

        await page.mouse.move(150, 50)
        await page.mouse.down()
        await page.mouse.move(150, 60, { steps: 3 })
        await page.waitForTimeout(50)
        await page.mouse.move(150, 110, { steps: 5 })
        await page.waitForTimeout(50)
        await page.mouse.move(150, 160, { steps: 5 })
        await page.waitForTimeout(400)

        // Item b has swapped into the first slot
        const b = await rect(page, "item-b")
        const bChild = await rect(page, "child-b")
        await page.mouse.up()
        expect(Math.abs(b.top - 0)).toBeLessThan(5)
        expect(Math.abs(bChild.top - b.top)).toBeLessThan(5)
    })
})
