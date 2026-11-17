import { expect, test } from "@playwright/test"

/**
 * See dev/react/src/tests/waapi-immediate-stop.tsx.
 */
test("an animation stopped before its keyframes resolve starts nothing", async ({
    page,
}) => {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))

    await page.goto("?test=waapi-immediate-stop")
    await page.waitForSelector("#box")
    await page.waitForTimeout(200)

    const box = page.locator("#box")
    expect(await box.textContent()).toBe("Content")
    expect(
        await box.evaluate((element) => element.getAnimations().length)
    ).toBe(0)
    expect(errors).toEqual([])
})
