import { expect, Page, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
    await page.goto("gestures/drag.html")
})

async function dragBy(page: Page, selector: string, dx: number, dy: number) {
    const box = (await page.locator(selector).boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2

    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 5 })
    await page.mouse.move(x + dx, y + dy, { steps: 5 })
    await page.mouse.up()
}

const offset = (page: Page, selector: string) =>
    page.locator(selector).evaluate((el) => {
        const { m41, m42 } = new DOMMatrix(getComputedStyle(el).transform)
        return { x: Math.round(m41), y: Math.round(m42) }
    })

test.describe("drag", () => {
    test("moves the element with the pointer", async ({ page }) => {
        await dragBy(page, "#free", 120, 40)
        expect(await offset(page, "#free")).toEqual({ x: 120, y: 40 })
        expect(await page.evaluate(() => (window as any).events)).toEqual([
            "start",
            "end",
        ])
    })

    test("locks to an axis", async ({ page }) => {
        await dragBy(page, "#axis", 120, 40)
        expect(await offset(page, "#axis")).toEqual({ x: 0, y: 40 })
    })

    test("stays within an element constraint", async ({ page }) => {
        await dragBy(page, "#constrained", 600, 600)
        expect(await offset(page, "#constrained")).toEqual({ x: 300, y: 200 })
    })
})
