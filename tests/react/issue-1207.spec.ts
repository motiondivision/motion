import { expect, test } from "@playwright/test"

/**
 * https://github.com/motiondivision/motion/issues/1207
 *
 * A slow overdamped spring layout animation
 * ({ stiffness: 4, damping: 35, mass: 0.5 }) should keep easing smoothly
 * towards its target. Physically, its slow mode decays at ~0.115/s, so
 * ~10s after starting it should still be roughly two thirds of the way
 * there. Instead it suddenly snaps to the end ~8.6s in.
 */
test("slow overdamped spring layout animation is not cut off", async ({
    page,
}) => {
    await page.goto("?test=issue-1207")
    const box = page.locator("#box")
    await expect(box).toBeVisible()

    // Start sampling the box position every frame from the click onwards
    await page.evaluate(() => {
        const w = window as any
        w.samples = []
        const el = document.getElementById("box")!
        const button = document.getElementById("toggle")!
        const start = performance.now()
        const sample = () => {
            w.samples.push([
                performance.now() - start,
                el.getBoundingClientRect().left,
            ])
            requestAnimationFrame(sample)
        }
        button.click()
        requestAnimationFrame(sample)
    })

    await page.waitForTimeout(10500)

    const samples: [number, number][] = await page.evaluate(
        () => (window as any).samples
    )
    const startLeft = samples[0][1]
    const progressAt = (ms: number) => {
        const s = samples.find(([t]) => t >= ms)!
        return (s[1] - startLeft) / 1000
    }

    // Control: early in the animation the spring is clearly in motion
    expect(progressAt(5000)).toBeGreaterThan(0.3)
    expect(progressAt(5000)).toBeLessThan(0.6)

    // At ~10s the physical spring is still only ~2/3 of the way there
    expect(progressAt(10000)).toBeLessThan(0.8)
})
