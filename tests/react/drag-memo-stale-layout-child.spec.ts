/**
 * A memoized dragged element isn't measured by its own willUpdate, so its
 * last layout can predate shifts that didn't go through projection (here,
 * #spacer is resized via the DOM mid-drag). When its `layout` child then
 * re-renders, neither the dragged element nor the child should jump: the
 * child should only animate its change relative to the dragged element.
 */
import { expect, test } from "@playwright/test"

for (const q of ["", "&parentLayout=true"]) {
    test(`memoized dragged parent moved outside a render${q}`, async ({
        page,
    }) => {
        await page.goto("?test=drag-memo-stale-layout-child" + q)
        await expect(page.locator("#handle")).toBeVisible()
        await page.waitForTimeout(200)

        const p0 = (await page.locator("#switch").boundingBox())!
        await page.mouse.move(p0.x + 200, p0.y + 50)
        await page.mouse.down()
        await page.mouse.move(p0.x + 210, p0.y + 60, { steps: 5 })
        await page.mouse.move(p0.x + 220, p0.y + 70, { steps: 5 })
        await page.waitForTimeout(200)

        await page.evaluate(() => {
            document.getElementById("spacer")!.style.height = "150px"
        })
        await page.waitForTimeout(100)

        const before = await page.evaluate(
            () => document.getElementById("switch")!.getBoundingClientRect().top
        )
        await page.keyboard.press("t")
        await page.waitForTimeout(150)

        const r = await page.evaluate(() => {
            const p = document.getElementById("switch")!.getBoundingClientRect()
            const c = document.getElementById("handle")!.getBoundingClientRect()
            return { x: c.left - p.left, y: c.top - p.top, top: p.top }
        })
        await page.mouse.up()

        // Parent doesn't jump, child doesn't lag vertically, and the child
        // is animating (not snapped) across its 10s linear transition.
        expect(r.top).toBeCloseTo(before, 0)
        expect(r.y).toBeCloseTo(0, 0)
        expect(r.x).toBeGreaterThan(0)
        expect(r.x).toBeLessThan(30)
    })
}
