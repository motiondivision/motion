import { expect, test } from "@playwright/test"

/**
 * htmlPlane without HTML-in-canvas. Runs in the html-in-canvas-off project,
 * which launches Chromium without the trial flag.
 */
test("htmlPlane fails soft without HTML-in-canvas", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))

    await page.goto("three/html-plane.html")
    await page.waitForFunction(() => (window as any).ready)

    const state = await page.evaluate(async () => {
        const { HTMLPlaneTest: h, test: t } = window as any
        for (let i = 0; i < 5; i++) await h.nextFrame()

        t.card.rotation.y = 0.6
        for (let i = 0; i < 3; i++) await h.nextFrame()

        const result = {
            support: t.support,
            isSupported: t.card.isSupported,
            visible: t.card.visible,
            cardParent: t.card.element.parentElement.tagName,
            drawable: t.card.element.hasAttribute("drawable"),
            content: t.canvas.getAttribute("content"),
            errors: t.errors,
        }

        t.card.dispose()
        t.form.dispose()
        await h.nextFrame()
        return result
    })

    expect(state).toEqual({
        support: "none",
        isSupported: false,
        visible: false,
        cardParent: "MAIN",
        drawable: false,
        content: null,
        errors: [],
    })

    /**
     * The element is still ordinary DOM.
     */
    await page.locator("#input").fill("typed")
    expect(await page.locator("#input").inputValue()).toBe("typed")
    expect(errors).toEqual([])
})
