import { expect, test } from "@playwright/test"

/**
 * A transition onUpdate needs the value every frame, so an opacity animation
 * with one runs in JS, not WAAPI. Without one, it stays accelerated.
 */
test("transition onUpdate fires for an accelerated value", async ({ page }) => {
    await page.goto("?test=animate-opacity-transition-onupdate")
    await page.waitForTimeout(300)

    const updates = await page.evaluate(() => (window as any).updates)
    expect(updates.length).toBeGreaterThan(1)
    expect(updates[updates.length - 1]).toBeGreaterThan(0.5)
    expect(updates[updates.length - 1]).toBeLessThan(1)

    const waapiCount = (id: string) =>
        page.locator(id).evaluate((el) => el.getAnimations().length)
    expect(await waapiCount("#with-onupdate")).toBe(0)
    expect(await waapiCount("#without-onupdate")).toBe(1)
})
