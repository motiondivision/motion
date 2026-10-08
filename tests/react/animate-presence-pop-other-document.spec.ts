import { expect, test } from "@playwright/test"

/**
 * #2319: popLayout must inject its style into the document the exiting
 * element is rendered in (here an iframe), not the global document.
 */
test("popLayout pops exiting elements rendered into another document", async ({
    page,
}) => {
    await page.goto("?test=animate-presence-pop-other-document")

    const frame = page.frameLocator("#frame")
    const a = frame.locator("#a")
    const b = frame.locator("#b")
    const top = () => b.evaluate((el) => el.getBoundingClientRect().top)

    await expect(b).toBeVisible()
    expect(await top()).toBe(100)

    await page.click("#toggle")
    await page.waitForTimeout(100)

    // The exiting element is still mid-exit, but popped out of the layout
    expect(await a.evaluate((el) => getComputedStyle(el).position)).toBe(
        "absolute"
    )
    expect(await top()).toBe(0)
})
