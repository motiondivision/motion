import { expect, test } from "@playwright/test"

/**
 * Issue #2365: `motion.svg` style prop changes don't get applied.
 *
 * Changing a plain (non-MotionValue) style on `motion.svg` between renders
 * should update the rendered element, exactly as it does on `svg` and
 * `motion.div`.
 */
test("style prop changes apply to motion.svg", async ({ page }) => {
    await page.goto("?test=issue-2365")

    const ids = ["plain-svg", "motion-svg", "motion-div"]

    for (const id of ids) {
        await expect(page.locator(`#${id}`)).toHaveCSS(
            "background-color",
            "rgb(255, 0, 0)"
        )
    }
    await expect(page.locator("#motion-svg-fill-rect")).toHaveCSS(
        "fill",
        "rgb(255, 0, 0)"
    )

    for (const id of [...ids, "motion-svg-fill"]) {
        await page.locator(`#${id}`).click()
    }

    for (const id of ids) {
        expect
            .soft(
                await page
                    .locator(`#${id}`)
                    .evaluate((e) => getComputedStyle(e).backgroundColor),
                `${id} background-color`
            )
            .toBe("rgb(0, 0, 255)")
    }

    expect
        .soft(
            await page
                .locator("#motion-svg-fill-rect")
                .evaluate((e) => getComputedStyle(e).fill),
            "motion.svg inherited fill"
        )
        .toBe("rgb(0, 0, 255)")
})
