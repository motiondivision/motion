import { expect, Page, test } from "@playwright/test"

/**
 * Issue #2348: `popLayout` position incorrectly calculated.
 *
 * Reporter's repro: AnimatePresence `mode="popLayout"` with `layout` items
 * exiting via `scale: 0.8, opacity: 0`, inside a `ul` with `position: fixed`.
 * In a fixed bottom-right container (a toast list), exiting items drop
 * downwards instead of shrinking towards their own centre.
 *
 * A scale exit keeps the box centre fixed, so an exiting item's centre must
 * not move.
 *
 * The bottom-anchored case fails on main (and identically on 10.16.4):
 * PopChild pins the popped item with `top: offsetTop`, but popping it out
 * shrinks the bottom-anchored `ul`, so the `ul`'s top edge (and the item with
 * it) moves down by the item's height + gap, and the `layout` animation then
 * carries the exiting item down there. `anchorY="bottom"` (`?anchorY=bottom`
 * on the test page) holds it in place; the default does not.
 */
interface Centre {
    x: number
    y: number
}

function readCentre(page: Page, id: string): Promise<Centre> {
    return page.evaluate((id) => {
        const box = document.getElementById(id)!.getBoundingClientRect()
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    }, id)
}

async function exitItem(page: Page, anchor: string, fixed: boolean) {
    await page.goto(`?test=issue-2348&anchor=${anchor}`)
    await expect(page.locator("#item-0")).toBeVisible()

    await page.locator("#pop-layout").check()
    if (fixed) await page.locator("#fixed").check()

    for (let i = 0; i < 3; i++) await page.locator("#add").click()
    await expect(page.locator("#item-3")).toBeVisible()

    /**
     * Let the spring layout animations from toggling `fixed` and adding items
     * settle before measuring.
     */
    await page.waitForTimeout(2000)

    const before = await readCentre(page, "item-1")

    await page.evaluate(() => document.getElementById("item-1")!.click())

    /**
     * Single read early in the spring exit, while the item is still popped
     * out and mid-scale.
     */
    await page.waitForTimeout(100)
    const after = await readCentre(page, "item-1")

    return { before, after }
}

for (const { anchor, fixed } of [
    { anchor: "top", fixed: false },
    { anchor: "top", fixed: true },
    { anchor: "bottom", fixed: true },
]) {
    test(`popLayout exiting item shrinks towards its centre (${
        fixed ? `fixed, ${anchor}-anchored` : "static"
    } container)`, async ({ page }) => {
        const { before, after } = await exitItem(page, anchor, fixed)

        expect(Math.abs(after.x - before.x)).toBeLessThan(3)
        expect(Math.abs(after.y - before.y)).toBeLessThan(3)
    })
}
