/**
 * A commit can start its layout update in an unmount, while React is already
 * changing the DOM. A memoized dragged element must still follow a layout
 * change that React made earlier in that commit, rather than measuring its
 * layout after it and moving off the pointer.
 */
import { expect, test } from "@playwright/test"

for (const q of ["", "&group"]) {
    test(`dragged element follows a layout change committed with an unmount${q}`, async ({
        page,
    }) => {
        await page.goto("?test=drag-memo-commit-unmount" + q)
        await expect(page.locator("#box")).toBeVisible()
        await page.waitForTimeout(200)

        const box = (await page.locator("#box").boundingBox())!
        const pointer = { x: box.x + 50 + 40, y: box.y + 50 + 40 }
        await page.mouse.move(box.x + 50, box.y + 50)
        await page.mouse.down()
        await page.mouse.move(pointer.x, pointer.y, { steps: 5 })
        await page.waitForTimeout(100)

        const measure = () =>
            page.evaluate(() => {
                const { left, top } = document
                    .getElementById("box")!
                    .getBoundingClientRect()
                return { x: left + 50, y: top + 50 }
            })

        const before = await measure()
        expect(Math.abs(before.y - pointer.y)).toBeLessThan(2)

        // #spacer grows by 100px and #gone unmounts
        await page.keyboard.press("r")
        await page.waitForTimeout(200)
        await expect(page.locator("#gone")).toHaveCount(0)
        const after = await measure()

        // And the drag carries on from there
        await page.mouse.move(pointer.x + 10, pointer.y, { steps: 2 })
        await page.waitForTimeout(100)
        const moved = await measure()
        await page.mouse.up()

        expect(Math.abs(after.x - pointer.x)).toBeLessThan(2)
        expect(Math.abs(after.y - pointer.y)).toBeLessThan(2)
        expect(Math.abs(moved.x - pointer.x - 10)).toBeLessThan(2)
        expect(Math.abs(moved.y - pointer.y)).toBeLessThan(2)
    })
}
