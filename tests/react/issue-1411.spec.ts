/**
 * https://github.com/motiondivision/motion/issues/1411
 *
 * A motion component whose layoutId changes after its first render should
 * use the NEW layoutId for shared layout animations. Element A starts with
 * layoutId "initial" and is updated to "shared" (either in a mount effect, as
 * in the report, or later via a click). A is then replaced by element B with
 * layoutId "shared". B should animate from A's position (left: 0) towards its
 * own (left: 400) over a 10s linear transition, rather than snapping to 400.
 */
import { expect, Page, test } from "@playwright/test"

async function measureAfterSwap(
    page: Page,
    query: string,
    clickChange = false
) {
    await page.goto(`?test=issue-1411&${query}`)
    await expect(page.locator("#a")).toBeVisible()
    await page.waitForTimeout(200)
    if (clickChange) await page.click("#change")
    await expect(page.locator("#current-id")).toHaveText("shared")
    await page.waitForTimeout(200)
    await page.click("#toggle")
    await expect(page.locator("#b")).toBeVisible()
    await page.waitForTimeout(1000)
    // Single point-in-time read (~10% into the animation)
    return page.evaluate(
        () => document.getElementById("b")!.getBoundingClientRect().left
    )
}

test.describe("issue #1411: changing layoutId after mount", () => {
    test("control: constant layoutId animates from previous element", async ({
        page,
    }) => {
        const left = await measureAfterSwap(page, "changed=false")
        expect(left).toBeLessThan(300)
    })

    test("layoutId changed in mount effect animates from previous element", async ({
        page,
    }) => {
        const left = await measureAfterSwap(page, "changed=true")
        expect(left).toBeLessThan(300)
    })

    test("layoutId changed later animates from previous element", async ({
        page,
    }) => {
        const left = await measureAfterSwap(
            page,
            "changed=true&late=true",
            true
        )
        expect(left).toBeLessThan(300)
    })
})
