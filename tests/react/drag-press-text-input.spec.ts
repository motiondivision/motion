import { expect, test } from "@playwright/test"

/**
 * #4053: a mouse press that starts a drag has its default prevented, which
 * stops a native text selection starting, but also stops the press moving
 * focus. Text inputs, selects and contenteditable keep both, so they can
 * be clicked into and typed in, whether they're inside an element whose
 * drag dragControls starts, or are the draggable themselves.
 */
const focused = (page: import("@playwright/test").Page) =>
    page.evaluate(() => document.activeElement?.id)

test.describe("pressing a text input that starts a drag", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("?test=drag-press-text-input")
        await page.waitForSelector("#drag-input")
    })

    for (const [id, focusedId] of [
        ["input", "input"],
        ["textarea", "textarea"],
        ["select", "select"],
        ["editable-child", "editable"],
        ["drag-input", "drag-input"],
    ]) {
        test(`focuses #${focusedId} when #${id} is pressed`, async ({
            page,
        }) => {
            await page.locator(`#${id}`).click()
            expect(await focused(page)).toBe(focusedId)
        })
    }

    for (const id of ["input", "textarea", "editable", "drag-input"]) {
        test(`#${id} can be clicked into and typed in`, async ({ page }) => {
            const element = page.locator(`#${id}`)
            await element.click()
            await page.keyboard.press("End")
            await page.keyboard.type("X")
            await expect
                .poll(() =>
                    element.evaluate((e) =>
                        "value" in e
                            ? (e as HTMLInputElement).value
                            : e.textContent
                    )
                )
                .toMatch(/X$/)
        })
    }
})
