/**
 * A memoized dragged element doesn't re-render when something else does,
 * so its last layout can predate a scroll that its drag has since followed.
 * A render elsewhere then mustn't count that scroll again as a layout
 * change, moving the element off the pointer.
 */
import { expect, test } from "@playwright/test"

for (const q of [
    "",
    "&layout",
    "&layoutId",
    "&layoutScroll",
    "&layout&layoutScroll",
    "&parentX",
    "&layout&parentX",
    "&child",
]) {
    test(`dragged element stays under the pointer after a scroll and a render elsewhere${q}`, async ({
        page,
    }) => {
        await page.goto("?test=drag-scroll-memo-commit" + q)
        await expect(page.locator("#box")).toBeVisible()
        await page.waitForTimeout(200)

        const box = (await page.locator("#box").boundingBox())!
        const pointer = { x: box.x + 50 + 40, y: box.y + 50 + 40 }
        await page.mouse.move(box.x + 50, box.y + 50)
        await page.mouse.down()
        await page.mouse.move(pointer.x, pointer.y, { steps: 5 })
        await page.waitForTimeout(100)

        await page.evaluate(() => {
            const scroller = document.getElementById("scroller")!
            scroller.scrollLeft = 30
            scroller.scrollTop = 60
        })
        await page.waitForTimeout(100)

        const measure = () =>
            page.evaluate(() => {
                const b = document.getElementById("box")!
                const c = document.getElementById("child")
                const { left, top } = b.getBoundingClientRect()
                const child = c?.getBoundingClientRect()
                return {
                    x: left + 50,
                    y: top + 50,
                    childX: child ? child.left - left : 0,
                    childY: child ? child.top - top : 0,
                }
            })

        // The drag follows the scroll
        const before = await measure()
        expect(Math.abs(before.x - pointer.x)).toBeLessThan(2)
        expect(Math.abs(before.y - pointer.y)).toBeLessThan(2)

        // #other renders, measuring layout but not re-rendering #box. Twice,
        // as the first can reset transforms that the second doesn't.
        const after = []
        for (let i = 0; i < 2; i++) {
            await page.keyboard.press("r")
            await page.waitForTimeout(150)
            after.push(await measure())
        }
        await page.mouse.up()

        for (const { x, y, childX, childY } of after) {
            expect(Math.abs(x - pointer.x)).toBeLessThan(2)
            expect(Math.abs(y - pointer.y)).toBeLessThan(2)
            expect(Math.abs(childX - before.childX)).toBeLessThan(2)
            expect(Math.abs(childY - before.childY)).toBeLessThan(2)
        }
    })
}
