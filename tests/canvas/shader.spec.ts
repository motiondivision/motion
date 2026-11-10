import { expect, Page, test } from "@playwright/test"

/**
 * #panel (top) and #second (at y: 120) are 200 x 100 and red, both drawn
 * through a shader that paints `tint` left of `progress` and white above
 * `band.x`.
 */
const red = [255, 0, 0, 255]
const blue = [0, 0, 255, 255]
const green = [0, 255, 0, 255]
const white = [255, 255, 255, 255]

const sample = (page: Page, points: [number, number][]) =>
    page.evaluate(async (list) => {
        const px = await (window as any).nextRender()
        return list.map(([x, y]) => px.at(x, y))
    }, points)

test.beforeEach(async ({ page }) => {
    await page.goto("canvas/shader.html")
    await page.waitForFunction(() => (window as any).ready)
})

test("uniform values from add() reach the shader", async ({ page }) => {
    expect(
        await sample(page, [
            [50, 50],
            [150, 50],
            [50, 170],
        ])
    ).toEqual([red, red, red])
})

test("animate() animates number and colour uniforms", async ({ page }) => {
    await page.evaluate(() => {
        const w = window as any
        w.animate(w.panel, { progress: 0.5 }, { duration: 0 })
    })
    expect(
        await sample(page, [
            [50, 50],
            [150, 50],
        ])
    ).toEqual([blue, red])

    await page.evaluate(() => {
        const w = window as any
        w.animate(w.panel, { tint: "#00ff00" }, { duration: 0 })
    })
    expect(await sample(page, [[50, 50]])).toEqual([green])
})

test("a uniform changes pixels mid-animation", async ({ page }) => {
    await page.evaluate(() => {
        const w = window as any
        w.MotionGlobalConfig.useManualTiming = true
        const start = w.frameData.timestamp
        w.processFrame(start)
        w.animate(
            w.panel,
            { progress: [0, 1] },
            { duration: 10, ease: "linear" }
        )
        w.processFrame(start + 5000)
    })
    // progress 0.5: tinted to x = 100
    expect(
        await sample(page, [
            [90, 50],
            [110, 50],
        ])
    ).toEqual([blue, red])
})

test("arrays of motion values and motion value uniforms", async ({ page }) => {
    await page.evaluate(() => (window as any).bandHeight.set(0.5))
    expect(
        await sample(page, [
            [150, 25],
            [150, 75],
        ])
    ).toEqual([white, red])

    // animate() animates the motion value the element was given
    await page.evaluate(() => {
        const w = window as any
        w.animate(w.second, { progress: 1 }, { duration: 0 })
    })
    expect(
        await sample(page, [
            [150, 170],
            [150, 50],
        ])
    ).toEqual([
        green,
        // #panel shares the program but keeps its own progress
        red,
    ])
    expect(
        await page.evaluate(() => (window as any).secondProgress.get())
    ).toBe(1)
})

test("a shader that doesn't compile warns and its element is drawn without it", async ({
    page,
}) => {
    // #broken is 40 x 40 and blue, at (240, 10)
    expect(await sample(page, [[260, 30]])).toEqual([blue])
    const warnings = await page.evaluate(() => (window as any).warnings)
    expect(warnings.join()).toMatch(/shader failed/)
})
