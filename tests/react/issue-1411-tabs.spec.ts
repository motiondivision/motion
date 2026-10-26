/**
 * https://github.com/motiondivision/motion/issues/1411
 *
 * Tabs that each render a highlight, with layoutId={selected ? "highlight" :
 * undefined}. The new highlight should animate from the old one's position
 * over a 1s linear transition, in both directions (so in both orders that
 * the two elements update in), with and without `layout`.
 */
import { expect, test } from "@playwright/test"

for (const layout of [false, true]) {
    test(`moves the highlight between tabs (layout ${layout})`, async ({
        page,
    }) => {
        await page.goto(`?test=issue-1411-tabs&layout=${layout}`)
        await expect(page.locator("#a")).toBeVisible()
        await page.waitForTimeout(200)

        const lefts: number[] = []
        for (const [to, from] of [
            ["b", "a"],
            ["a", "b"],
        ]) {
            await page.click("#select-" + to)
            // Single point-in-time read, about halfway through
            await page.waitForTimeout(500)
            lefts.push(
                await page.evaluate(
                    (id) => document.getElementById(id)!.getBoundingClientRect().left,
                    to
                )
            )
            expect(
                await page.evaluate(
                    (id) => getComputedStyle(document.getElementById(id)!).visibility,
                    from
                )
            ).toBe("visible")
            await page.waitForTimeout(800)
        }

        const [aToB, bToA] = lefts
        const left = (await page.locator("#a").boundingBox())!.x
        // Halfway between left and left + 300, not snapped to either end
        expect(aToB - left).toBeGreaterThan(50)
        expect(aToB - left).toBeLessThan(250)
        expect(bToA - left).toBeGreaterThan(50)
        expect(bToA - left).toBeLessThan(250)
    })
}
