/**
 * Moving a dragged element's layout outside of a render (e.g. content above
 * it resizing) mustn't be mistaken for a layout change of the dragged
 * element when it later re-renders, or its `layout` children would animate
 * despite not moving relative to it.
 */
import { expect, test } from "@playwright/test"

test("layout child doesn't animate after its dragged parent moved outside a render", async ({
    page,
}) => {
    await page.goto("?test=drag-stale-layout-child")
    await expect(page.locator("#child")).toBeVisible()
    await page.waitForTimeout(200)

    await page.evaluate(() => {
        document.getElementById("spacer")!.style.height = "150px"
    })
    await page.waitForTimeout(100)

    const parent = (await page.locator("#parent").boundingBox())!
    await page.mouse.move(parent.x + 200, parent.y + 100)
    await page.mouse.down()
    await page.mouse.move(parent.x + 210, parent.y + 110, { steps: 5 })
    await page.mouse.move(parent.x + 220, parent.y + 120, { steps: 5 })
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
