import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
    await page.goto("gestures/hover.html")
})

test.describe("hover", () => {
    // CI doesn't support hover pointer types
    if (process.env.CI) {
        test.skip()
    }

    test("default hover settings work correctly", async ({ page }) => {
        const element = page.locator("#hover")
        await expect(element).toHaveText("test")
        await element.hover()
        await expect(element).toHaveText("start")
        await page.mouse.move(1000, 1000) // Move mouse away to trigger hover out
        await expect(element).toHaveText("end")
    })

    test("hover handles multiple attached handlers correctly", async ({
        page,
    }) => {
        const element = page.locator("#hover")
        await element.hover()
        // Check color is green on press start
        const colorOnPress = await element.evaluate((el) => {
            return window.getComputedStyle(el).color
        })
        expect(colorOnPress).toBe("rgb(0, 128, 0)") // green
        await expect(element).toHaveText("start")
        await page.mouse.move(1000, 1000) // Move mouse away to trigger hover out
        // Check color is purple after press end
        const colorAfterPress = await element.evaluate((el) => {
            return window.getComputedStyle(el).color
        })
        expect(colorAfterPress).toBe("rgb(128, 0, 128)") // purple
    })

    test("once works correctly", async ({ page }) => {
        const multi = page.locator("#multi")
        const once = page.locator("#once")

        await expect(multi).toHaveText("multi")
        await expect(once).toHaveText("once")
        await multi.hover()
        await expect(multi).toHaveText("0")
        await once.hover()
        await expect(once).toHaveText("0")
        await page.mouse.move(1000, 1000)
        await expect(multi).toHaveText("1")
        await expect(once).toHaveText("1")
        await multi.hover()
        await expect(multi).toHaveText("2")
        await once.hover()
        await expect(once).toHaveText("1")
        await page.mouse.move(1000, 1000)
        await expect(multi).toHaveText("3")
        await expect(once).toHaveText("1")
    })
})
