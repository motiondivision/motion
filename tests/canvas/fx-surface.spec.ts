import { expect, test } from "@playwright/test"

/**
 * <motion-fx> is at the page's top-left, 400 x 300 CSS pixels. #card is a
 * red button, 100 x 60, at its top-left. #above is green, 100 x 60, at
 * (200, -200), so outside the element. #stripes is 64 x 64 at (0, 100),
 * with red and blue stripes of one pixel.
 */
const red = [255, 0, 0, 255]
const green = [0, 255, 0, 255]

const settle = async (page: any, shaders: string) =>
    page.evaluate(async (source: string) => {
        const w = window as any
        w.host.shaders = [w[source]()]
        // The shader compiles and the hit map is read back over frames
        for (let i = 0; i < 8; i++) await w.nextRender()
    }, shaders)

test.describe("<motion-fx> vertex stage", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("canvas/fx-surface.html")
        await page.waitForFunction(() => (window as any).ready)
    })

    test("a shader with a vertex function draws on a mesh", async ({
        page,
    }) => {
        await settle(page, "half")
        const result = await page.evaluate(async () => {
            const w = window as any
            const px = await w.nextRender()
            return {
                card: px.at(225, 30),
                flat: px.at(50, 30),
                right: px.at(260, 30),
                warnings: w.warnings.join(),
            }
        })
        expect(result.warnings).toBe("")
        expect(result.card).toEqual(red)
        expect(result.flat[3]).toBe(0)
        expect(result.right[3]).toBe(0)
    })

    test("extend makes the scene larger than the canvas", async ({ page }) => {
        const before = await page.evaluate(async () => {
            const px = await (window as any).nextRender()
            return px.at(250, 65)
        })
        expect(before[3]).toBe(0)

        await settle(page, "whole")
        const result = await page.evaluate(async () => {
            const w = window as any
            const px = await w.nextRender()
            return {
                card: px.at(50, 165),
                flat: px.at(50, 30),
                above: px.at(250, 65),
            }
        })
        expect(result.card).toEqual(red)
        expect(result.flat[3]).toBe(0)
        expect(result.above).toEqual(green)
    })

    test("a mesh that draws small reads mipmaps", async ({ page }) => {
        await settle(page, "small")
        const pixels = await page.evaluate(async () => {
            const px = await (window as any).nextRender()
            return [1.5, 2.5, 3.5, 4.5, 5.5, 6.5].map((x) => px.at(x, 17.5))
        })
        // One-pixel stripes average out. Without mipmaps they alias.
        for (const [r, g, b] of pixels) {
            expect(r).toBeGreaterThan(95)
            expect(r).toBeLessThan(160)
            expect(b).toBeGreaterThan(95)
            expect(b).toBeLessThan(160)
            expect(g).toBeLessThan(10)
        }
    })

    test("unproject() and hit testing follow the mesh", async ({ page }) => {
        await settle(page, "half")
        const points = await page.evaluate(() => {
            const { layer } = (window as any).host
            return {
                card: layer.unproject(225, 30),
                empty: layer.unproject(50, 30),
            }
        })
        expect(points.empty).toBeUndefined()
        expect(Math.abs(points.card.x - 50)).toBeLessThan(2)
        expect(Math.abs(points.card.y - 30)).toBeLessThan(2)

        // The card is drawn at 200-250, not where it's laid out
        await page.mouse.move(220, 30)
        await page.mouse.move(225, 30)
        await page.mouse.click(225, 30)
        expect(await page.evaluate(() => (window as any).clicks)).toBe(1)

        await page.mouse.move(45, 30)
        await page.mouse.move(50, 30)
        await page.mouse.click(50, 30)
        expect(await page.evaluate(() => (window as any).clicks)).toBe(1)
    })
})
