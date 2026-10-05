/**
 * https://github.com/motiondivision/motion/issues/1831
 *
 * A draggable element with animate={["base", "exiting", "center"]} (and also a
 * single "center" label) should not fire onAnimationComplete when a drag is
 * merely released: the animate prop hasn't changed, so no variant animation
 * has run. Currently, releasing the drag deactivates "whileDrag", which
 * re-runs every animate label and immediately fires onAnimationComplete once
 * per label (all three variants), before the snap-back has even happened.
 */
import { expect, Page, test } from "@playwright/test"

async function settle(page: Page, single: boolean) {
    await page.goto(`?test=issue-1831&single=${single}`)
    await expect(page.locator("#box")).toBeVisible()
    // Wait for the mount animation (0.2s) to complete, then clear the log
    await expect
        .poll(() => page.evaluate(() => window.completed.length))
        .toBeGreaterThan(0)
    await page.waitForTimeout(300)
    await page.evaluate(() => (window.completed = []))
}

async function dragAndRelease(page: Page) {
    await page.mouse.move(300, 200)
    await page.mouse.down()
    await page.mouse.move(320, 200, { steps: 5 })
    await page.mouse.move(360, 200, { steps: 5 })
    await page.waitForTimeout(100)
    await page.mouse.up()
    await page.waitForTimeout(100)
    return page.evaluate(() => [...window.completed])
}

test.describe("issue #1831: drag release triggers animating variants", () => {
    test("control: no onAnimationComplete without interaction", async ({
        page,
    }) => {
        await settle(page, false)
        await page.waitForTimeout(300)
        expect(await page.evaluate(() => window.completed)).toEqual([])
    })

    test("releasing drag doesn't fire onAnimationComplete for every variant", async ({
        page,
    }) => {
        await settle(page, false)
        expect(await dragAndRelease(page)).toEqual([])
    })

    test("releasing drag doesn't fire onAnimationComplete for a single variant", async ({
        page,
    }) => {
        await settle(page, true)
        expect(await dragAndRelease(page)).toEqual([])
    })
})
