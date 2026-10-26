import { expect, test } from "@playwright/test"

/**
 * The page morphs a 100x100 square (area 10000) into a star (area 2826).
 */
test.describe("morph", () => {
    test("morphs an SVG path between different shapes", async ({ page }) => {
        await page.goto("animate/animate-morph.html")
        await page.waitForTimeout(1000)

        const { d, styleD, area } = await page
            .locator("#morph")
            .evaluate((element: SVGPathElement) => ({
                d: element.getAttribute("d")!,
                styleD: element.style.getPropertyValue("d"),
                area: (window as any).polylineArea(element.getAttribute("d")),
            }))

        // In between, the shape is written to the attribute as a polyline
        expect(styleD).toBe("")
        expect(d).toMatch(/^M[\d.\s-]+Z$/)
        expect(d.split(" ").length).toBeGreaterThan(40)

        // A tenth of the way to the star
        expect(area).toBeLessThan(9800)
        expect(area).toBeGreaterThan(5000)
    })

    test("continues an interrupted morph from where it was", async ({
        page,
    }) => {
        await page.goto("animate/animate-morph.html")
        const path = page.locator("#interrupt")
        await expect(path).toHaveAttribute("data-after", /width/)

        const { before, after } = await path.evaluate(
            (element: SVGPathElement) => ({
                before: JSON.parse(element.dataset.before!),
                after: JSON.parse(element.dataset.after!),
            })
        )

        // Interrupted part way from the square to the star
        expect(before.area).toBeLessThan(9800)
        expect(before.area).toBeGreaterThan(3500)

        // The next morph starts from that shape
        for (const key of ["x", "y", "width", "height", "length"]) {
            expect(Math.abs(after[key] - before[key])).toBeLessThan(2)
        }
        expect(Math.abs(after.area - before.area)).toBeLessThan(100)
    })

    test("mixes other values in the same transition as usual", async ({
        page,
    }) => {
        await page.goto("animate/animate-morph.html")
        await page.waitForTimeout(1000)

        const { d, fill } = await page
            .locator("#both")
            .evaluate((element: SVGPathElement) => ({
                d: element.getAttribute("d")!,
                fill: getComputedStyle(element).fill,
            }))

        expect(d).toMatch(/^M[\d.\s-]+Z$/)
        const [r, g, b] = fill.match(/[\d.]+/g)!.map(Number)
        expect(r).toBeGreaterThan(0)
        expect(r).toBeLessThan(255)
        expect(b).toBeGreaterThan(0)
        expect(b).toBeLessThan(255)
        expect(g).toBe(0)
    })
})
