import { expect, test } from "@playwright/test"

/**
 * Issue #2390: CSS variables used as `y` animation targets break drag.
 * The box (height 400) animates to y: var(--slide-to) = 20% = 80px.
 * Dragging the handle down 50px should move the box to ~130px, not jump.
 */
for (const [name, query] of [
    ["CSS variable", ""],
    ["hardcoded percentage (control)", "&hardcoded=true"],
]) {
    test(`drag after animating y to a ${name} doesn't jump`, async ({
        page,
    }) => {
        await page.goto(`?test=issue-2390${query}`)
        const box = page.locator("#box")
        await expect(box).toBeVisible()
        await page.waitForTimeout(1500)

        const top = async () => (await box.boundingBox())!.y
        const before = await top()
        expect(before).toBeCloseTo(80, 0)

        const handle = (await page.locator("#handle").boundingBox())!
        const x = handle.x + handle.width / 2
        const y = handle.y + handle.height / 2
        await page.mouse.move(x, y)
        await page.mouse.down()
        // Read mid-drag positions once each, not retried
        const positions: number[] = []
        for (let i = 1; i <= 10; i++) {
            await page.mouse.move(x, y + i * 5)
            await page.waitForTimeout(32)
            positions.push(await top())
        }
        const midDrag = await top()
        await page.mouse.up()

        // Box should follow the pointer: 80 + 50 = 130
        expect(midDrag).toBeCloseTo(130, -1)
        for (const p of positions) {
            expect(p).toBeGreaterThanOrEqual(before - 1)
            expect(p).toBeLessThanOrEqual(before + 51)
        }

        // Short drag (< threshold) returns to var(--slide-to) = 80px
        await page.waitForTimeout(1500)
        expect(await top()).toBeCloseTo(80, 0)
    })
}
