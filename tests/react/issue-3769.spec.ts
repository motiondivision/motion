import { expect, test } from "@playwright/test"

/**
 * #3769: a useTransform value derived from a MotionValue that is set in an
 * effect should follow it under Strict Mode (source 10, derived 20). Under
 * React 18 the derived value's scheduled update is cancelled by the Strict
 * Mode cleanup and never re-run, so it stays at 0.
 */
for (const id of ["effect", "layout-effect"]) {
    test(`useTransform follows a value set in a ${id} under Strict Mode`, async ({
        page,
    }) => {
        await page.goto("?test=issue-3769")
        const el = page.locator(`#${id}`)
        await expect(el).toBeVisible()

        // Give any scheduled frame plenty of time to flush.
        await page.waitForTimeout(500)

        const values = await page.evaluate((id) => {
            const { x, doubled } = (window as any)[id]
            return [x.get(), doubled.get()]
        }, id)
        expect(values).toEqual([10, 20])
        expect(await el.textContent()).toBe("20")
    })
}
