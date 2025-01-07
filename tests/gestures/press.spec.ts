import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
    await page.goto("gestures/press.html")
})

test.describe("press events", () => {
    // CI pointers not working well
    if (process.env.CI) {
        test.skip()
    }

    test("press responds correctly to keyboard events", async ({ page }) => {
        // Tab to first element
        await page.keyboard.press("Tab")

        // Initial state
        const pressDiv = page.locator("#press-div")
        await expect(pressDiv).toHaveText("press")

        // Check background color is red when focused
        const backgroundColor = await pressDiv.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor
        })
        expect(backgroundColor).toBe("rgb(255, 0, 0)")

        // Press 'a' key - should not trigger press
        await page.keyboard.down("a")
        await expect(pressDiv).toHaveText("press")

        // Press Enter - should trigger press start
        await page.keyboard.down("Enter")
        await expect(pressDiv).toHaveText("start")

        // Release 'a' key - should maintain press state
        await page.keyboard.up("a")
        await expect(pressDiv).toHaveText("start")

        // Release Enter - should trigger press end
        await page.keyboard.up("Enter")
        await expect(pressDiv).toHaveText("end")
    })

    test("press handles focus changes correctly", async ({ page }) => {
        // Tab to first element
        await page.keyboard.press("Tab")
        const pressDiv = page.locator("#press-div")
        const pressDivCancel = page.locator("#press-div-cancel")

        // Start press on first element
        await page.keyboard.down("Enter")
        await expect(pressDiv).toHaveText("start")

        // Tab to next element
        await page.keyboard.press("Tab")

        // Check first element returned to blue
        const pressDivColor = await pressDiv.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor
        })
        expect(pressDivColor).toBe("rgb(0, 119, 255)")

        // Check second element is red (focused)
        const pressDivCancelColor = await pressDivCancel.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor
        })
        expect(pressDivCancelColor).toBe("rgb(255, 0, 0)")

        // Check first press ended
        await expect(pressDiv).toHaveText("end")

        // Press sequence on second element
        await page.keyboard.down("Enter")
        await expect(pressDivCancel).toHaveText("start")
        await page.keyboard.up("Enter")
        await expect(pressDivCancel).toHaveText("end")
        await page.keyboard.down("Enter")
        await expect(pressDivCancel).toHaveText("start")

        // Shift-tab back - should cancel press
        await page.keyboard.down("Shift")
        await page.keyboard.press("Tab")
        await page.keyboard.up("Shift")
        await expect(pressDivCancel).toHaveText("cancel")
    })

    test("press handles pointer events correctly", async ({ page }) => {
        const pressDiv = page.locator("#press-div")

        // Start press
        await pressDiv.dispatchEvent("pointerdown", { isPrimary: true })
        await expect(pressDiv).toHaveText("start")

        // Release pointer - should trigger press end
        await page.dispatchEvent("body", "pointerup", { isPrimary: true })
        await expect(pressDiv).toHaveText("end")
    })

    test("press handles pointer movement correctly", async ({ page }) => {
        const pressDiv = page.locator("#press-div")
        const pressDivCancel = page.locator("#press-div-cancel")

        // Start press on first element
        await pressDiv.dispatchEvent("pointerdown", { isPrimary: true })
        await expect(pressDiv).toHaveText("start")

        // Move pointer to second element
        await pressDivCancel.dispatchEvent("pointerenter")
        await page.dispatchEvent("body", "pointerup", { isPrimary: true })

        // Check first element returned to blue
        const pressDivColor = await pressDiv.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor
        })
        expect(pressDivColor).toBe("rgb(0, 119, 255)")

        // Check first press ended
        await expect(pressDiv).toHaveText("end")

        // Press sequence on second element
        await pressDivCancel.dispatchEvent("pointerdown", { isPrimary: true })
        await expect(pressDivCancel).toHaveText("start")
        await pressDivCancel.dispatchEvent("pointerup", { isPrimary: true })
        await expect(pressDivCancel).toHaveText("end")
        await pressDivCancel.dispatchEvent("pointerdown", { isPrimary: true })
        await expect(pressDivCancel).toHaveText("start")
        await page.dispatchEvent("body", "pointerup", { isPrimary: true })
        await expect(pressDivCancel).toHaveText("cancel")
    })

    test("press doesn't respond to right click", async ({ page }) => {
        const pressDiv = page.locator("#press-div")

        // Right click (button: 2)
        await pressDiv.dispatchEvent("pointerdown", {
            button: 2,
            isPrimary: false,
        })

        // Text should not change to "start" since right click shouldn't trigger press
        await expect(pressDiv).not.toHaveText("start")

        // Release right click
        await page.dispatchEvent("body", "pointerup", {
            button: 2,
            isPrimary: false,
        })

        // Text should still not have changed
        await expect(pressDiv).not.toHaveText("end")
    })
})
test.describe("press accessibility", () => {
    test("button", async ({ page }) => {
        const button = page.locator("#press-no-tab-index-1")

        // Check button tabindex remains -1
        const buttonTabIndex = await button.evaluate((el) => el.tabIndex)
        expect(buttonTabIndex).toBe(-1)
    })

    test("div", async ({ page }) => {
        const div = page.locator("#press-no-tab-index-2")

        // Check div tabindex remains -1
        const divTabIndex = await div.evaluate((el) => el.tabIndex)
        expect(divTabIndex).toBe(-1)
    })
})
