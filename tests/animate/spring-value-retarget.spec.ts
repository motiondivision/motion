import { expect, test } from "@playwright/test"

test("springValue renders repeated numeric and percentage targets and completes once", async ({
    page,
}) => {
    await page.goto("animate/spring-value-retarget.html")
    const result = await page.evaluate(() => (window as any).run())
    expect(result.maxRenderError).toBeLessThan(0.001)
    expect(result.finalPositions).toEqual(Array(32).fill(80))
    expect(result.jumpedPositions).toEqual(Array(32).fill(0))
    expect(result.completions).toBe(32)
    expect(result.animating).toBe(false)
})
