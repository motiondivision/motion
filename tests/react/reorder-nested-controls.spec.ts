import { expect, Page, test } from "@playwright/test"

/**
 * Reorder items have keyboard grab-and-move (#2658), with one item as the
 * group's tab stop. Controls inside an item must behave as they do without
 * Reorder: their keys and clicks are theirs, and they stay in the tab order.
 */
const text = (page: Page, id: string) => page.locator(id).textContent()
const focused = (page: Page) => page.evaluate(() => document.activeElement?.id)
/**
 * Grabbed items show their whileDrag opacity, read after it has rendered.
 */
const grabbed = (page: Page) =>
    page.evaluate(async () => {
        await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
        )
        return Array.from(document.querySelectorAll("li"))
            .filter((element) => getComputedStyle(element).opacity === "0.5")
            .map((element) => element.id)
            .join(",")
    })
const scrollY = (page: Page) => page.evaluate(() => window.scrollY)

test.describe("Reorder items with nested controls", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("?test=reorder-nested-controls")
        await page.waitForSelector("#a")
    })

    test("tab order visits one item, then every item's controls", async ({
        page,
    }) => {
        await page.focus("#a")
        const ids: (string | undefined)[] = []
        for (let i = 0; i < 4; i++) {
            await page.keyboard.press("Tab")
            ids.push(await focused(page))
        }
        // Only one item is a tab stop, so b is reached with the arrows
        expect(ids).toEqual(["a-checkbox", "a-button", "a-link", "b-checkbox"])
    })

    test("Space toggles a nested checkbox without grabbing", async ({
        page,
    }) => {
        await page.focus("#b-checkbox")
        await page.keyboard.press("Space")
        expect(await text(page, "#checked")).toBe("b")
        await expect.poll(() => grabbed(page)).toBe("")
        await page.keyboard.press("ArrowUp")
        expect(await text(page, "#order")).toBe("a,b,c")
        expect(await focused(page)).toBe("b-checkbox")
    })

    test("Space and Enter press a nested button", async ({ page }) => {
        await page.focus("#b-button")
        await page.keyboard.press("Space")
        await page.keyboard.press("Enter")
        expect(await text(page, "#clicks")).toBe("2")
        await expect.poll(() => grabbed(page)).toBe("")
    })

    test("Enter follows a nested link", async ({ page }) => {
        await page.focus("#b-link")
        await page.keyboard.press("Enter")
        await expect
            .poll(() => page.evaluate(() => location.hash))
            .toBe("#link")
    })

    test("clicking a checkbox or its label toggles it", async ({ page }) => {
        await page.click("#a-checkbox")
        await page.click("#c-label")
        expect(await text(page, "#checked")).toBe("a,c")
        expect(await focused(page)).toBe("c-checkbox")
    })

    test("clicking a control drops a grabbed item", async ({ page }) => {
        await page.focus("#a")
        await page.keyboard.press("Space")
        await expect.poll(() => grabbed(page)).toBe("a")
        await page.click("#b-checkbox")
        await expect.poll(() => grabbed(page)).toBe("")
        expect(await text(page, "#checked")).toBe("b")
    })

    test("pressing an item doesn't scroll the page", async ({ page }) => {
        // Leave item "a" half off the bottom of the viewport
        const box = (await page.locator("#a").boundingBox())!
        await page.evaluate(
            (y) => window.scrollTo(0, y),
            box.y + box.height / 2 - page.viewportSize()!.height
        )
        const before = await scrollY(page)
        const a = (await page.locator("#a-text").boundingBox())!
        await page.mouse.click(a.x + 2, a.y + 2)
        expect(await focused(page)).toBe("a")
        expect(await scrollY(page)).toBe(before)
    })

    test("dragging an item still reorders", async ({ page }) => {
        const a = (await page.locator("#a-text").boundingBox())!
        await page.mouse.move(a.x + 2, a.y + 2)
        await page.mouse.down()
        for (let i = 1; i <= 10; i++) {
            await page.mouse.move(a.x + 2, a.y + 2 + i * 9)
        }
        await page.mouse.up()
        expect(await text(page, "#order")).toBe("b,a,c")
    })
})
