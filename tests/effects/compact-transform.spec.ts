import { expect, test } from "@playwright/test"

test("compact translations preserve computed percentage, pixel and mixed transforms", async ({
    page,
}) => {
    await page.goto("effects/compact-transform.html")
    const result = await page.evaluate(() => (window as any).run())
    expect(result.percent).toEqual([100, 25])
    expect(result.pixels).toEqual([20, -10])
    expect(result.mixed).toEqual([20, -10])
    expect(result.style).toBe(
        "translateX(20px) translateY(-10px) rotate(90deg)"
    )
})
