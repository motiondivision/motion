import { expect, test } from "@playwright/test"

/**
 * #2611: rotateZ is dropped from the transform once an element takes part
 * in a shared layout (layoutId) animation. buildProjectionTransform only
 * writes rotate/rotateX/rotateY, so the element renders at 0deg during the
 * animation and is left at `transform: none` afterwards. `rotate` works.
 */
async function angle(page) {
    return page.locator("#box").evaluate((el) => {
        const m = new DOMMatrix(getComputedStyle(el).transform)
        return Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI)
    })
}

test("Issue #2611: rotateZ survives a shared layout animation", async ({
    page,
}) => {
    await page.goto("?test=issue-2611&prop=rotateZ")
    await page.waitForTimeout(800)
    expect(await angle(page)).toBe(45)

    for (let i = 0; i < 2; i++) {
        await page.click("#box")
        await page.waitForTimeout(200)
        // Mid layout animation
        expect(await angle(page)).toBeGreaterThan(20)

        await page.waitForTimeout(1000)
        expect(await angle(page)).toBe(45)
    }
})
