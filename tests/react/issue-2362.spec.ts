import { expect, test } from "@playwright/test"

/**
 * https://github.com/motiondivision/motion/issues/2362
 *
 * Mixing layoutId with initial/animate: when the element with the layoutId is
 * conditionally rendered in a new place, the shared layout animation moves it
 * there. It shouldn't fade back in from its initial opacity, because visually
 * it's the same element continuing.
 */
test("layoutId element doesn't re-run its initial animation when it moves", async ({
    page,
}) => {
    await page.goto("?test=issue-2362")

    const underline = page.locator("#underline")

    // Let the first mount's initial -> animate fade finish.
    await expect(underline).toHaveCSS("opacity", "1", { timeout: 5000 })
    const before = await underline.boundingBox()

    await page.locator("#tab-1").click()

    // ~20% into the fade the bug would produce. Single-point read: .should()-style
    // retrying would wait out the animation and hide the bug.
    await page.waitForTimeout(400)
    const opacity = await underline.evaluate((element) =>
        Number(getComputedStyle(element).opacity)
    )

    // The shared layout animation did move it.
    const after = await underline.boundingBox()
    expect(after!.x).toBeGreaterThan(before!.x)

    expect(opacity).toBeGreaterThan(0.9)
})
