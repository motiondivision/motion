import { expect, Page, test } from "@playwright/test"

const transform = (page: Page) =>
    page.$eval("#box", (element) => getComputedStyle(element).transform)

/**
 * #3787: after unkeyed siblings swap (as with Fast Refresh), the box is
 * rendered by the component that animated scale from initial to animate.
 */
test.describe("whileHover/whileTap after siblings swap", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("?test=while-hover-after-reorder")
        await expect(page.locator("#sibling")).toHaveCSS("opacity", "1")
        await page.click("#swap")
        await expect(page.locator("#sibling")).toHaveCSS("opacity", "1")
        await expect.poll(() => transform(page)).toBe("none")
    })

    test("whileHover returns to rest when the pointer leaves", async ({
        page,
    }) => {
        await page.hover("#box")
        await expect
            .poll(() => transform(page))
            .toBe("matrix(1.2, 0, 0, 1.2, 0, 0)")

        await page.mouse.move(0, 0)
        await expect.poll(() => transform(page)).toBe("none")
    })

    test("whileTap returns to rest when the press ends", async ({ page }) => {
        await page.hover("#box")
        await page.mouse.down()
        await expect
            .poll(() => transform(page))
            .toBe("matrix(0.8, 0, 0, 0.8, 0, 0)")

        await page.mouse.up()
        await page.mouse.move(0, 0)
        await expect.poll(() => transform(page)).toBe("none")
    })
})

const opacity = (page: Page) =>
    page.$eval("#box", (element) =>
        parseFloat(getComputedStyle(element).opacity)
    )

test("whileHover returns to where an interrupted animation stopped", async ({
    page,
}) => {
    await page.goto("?test=while-hover-after-reorder&midflight")
    await page.waitForTimeout(1500)
    await page.click("#swap")
    await page.waitForTimeout(500)

    const rest = await opacity(page)
    expect(rest).toBeGreaterThan(0.1)
    expect(rest).toBeLessThan(0.7)

    await page.hover("#box")
    await expect.poll(() => opacity(page)).toBe(0.8)

    await page.mouse.move(0, 0)
    await expect.poll(() => opacity(page)).toBeCloseTo(rest, 2)
})
