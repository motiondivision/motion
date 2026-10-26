/**
 * https://github.com/motiondivision/motion/issues/1411
 *
 * When element A's layoutId changes to one that element B already leads, A
 * takes over from B instantly: A is already on screen, so it stays where it
 * is rather than animating from B's box as an element mounting with that
 * layoutId would, and B, now a follower, is hidden. B is a sibling that
 * doesn't re-render for the change (constant layoutDependency, as a memoised
 * item wouldn't re-render at all), so the takeover itself must hide it.
 */
import { expect, test } from "@playwright/test"

test("an element that takes a mounted element's layoutId takes over instantly", async ({
    page,
}) => {
    await page.goto("?test=issue-1411-takeover")
    await expect(page.locator("#a")).toBeVisible()
    await page.waitForTimeout(200)
    const before = await page.evaluate(
        () => document.getElementById("a")!.getBoundingClientRect().left
    )
    await page.click("#change")
    // ~10% into what would be a 10s linear animation from B (left: 400)
    await page.waitForTimeout(1000)
    const a = await page.evaluate(
        () => document.getElementById("a")!.getBoundingClientRect().left
    )
    // A stays where it is
    expect(Math.abs(a - before)).toBeLessThan(1)
    await expect(page.locator("#a")).toHaveCSS("visibility", "visible")
    await expect(page.locator("#a")).toHaveCSS("opacity", "1")
    // B, which now follows A, is hidden
    await expect(page.locator("#b")).toHaveCSS("visibility", "hidden")
})
