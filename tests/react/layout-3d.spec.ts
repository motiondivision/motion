import { expect, Page, test } from "@playwright/test"

/**
 * domMax3D: layout animations inside and into a container that CSS turns
 * by 40deg. Halfway through, the box should still be a 100x80 rectangle,
 * turned with its space, and centred halfway between where it starts and
 * where it ends. dev/react/src/tests/layout-3d.tsx.
 */

type Point = { x: number; y: number }

const corners = (page: Page): Promise<Point[]> =>
    page.evaluate(() =>
        [...document.querySelectorAll("#box [data-probe]")].map((probe) => {
            const { left, top } = probe.getBoundingClientRect()
            return { x: left, y: top }
        })
    )

const centre = (quad: Point[]) => ({
    x: quad.reduce((sum, p) => sum + p.x, 0) / 4,
    y: quad.reduce((sum, p) => sum + p.y, 0) / 4,
})

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

async function load(page: Page, query: string) {
    await page.goto(`?test=layout-3d${query}`)
    await page.waitForSelector("#box [data-probe]", { state: "attached" })
    await page.waitForTimeout(200)
    return corners(page)
}

async function expectRigidHalfway(page: Page, query: string) {
    const end = await load(page, `${query}&end`)
    const start = await load(page, query)

    await page.evaluate(() => (window as any).move())
    await page.waitForTimeout(5000)
    const mid = await corners(page)

    // Still a 100x80 rectangle: sides and both diagonals keep their length.
    expect(distance(mid[0], mid[1])).toBeCloseTo(100, 0)
    expect(distance(mid[1], mid[2])).toBeCloseTo(80, 0)
    expect(distance(mid[2], mid[3])).toBeCloseTo(100, 0)
    expect(distance(mid[3], mid[0])).toBeCloseTo(80, 0)
    expect(distance(mid[0], mid[2])).toBeCloseTo(Math.hypot(100, 80), 0)
    expect(distance(mid[1], mid[3])).toBeCloseTo(Math.hypot(100, 80), 0)

    // Halfway between its start and end, give or take timing.
    const a = centre(start)
    const b = centre(end)
    const halfway = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    expect(distance(centre(mid), halfway)).toBeLessThan(12)

    return { start, mid, end }
}

test.describe("domMax3D layout animations", () => {
    test.setTimeout(60000)

    test("move a box inside a turned container", async ({ page }) => {
        await expectRigidHalfway(page, "")
    })

    test("move a layoutId card from a flat container into a turned one", async ({
        page,
    }) => {
        const { mid } = await expectRigidHalfway(page, "&shared")

        // Turned about halfway, 20deg of 40deg.
        const angle =
            (Math.atan2(mid[1].y - mid[0].y, mid[1].x - mid[0].x) * 180) /
            Math.PI
        expect(angle).toBeGreaterThan(14)
        expect(angle).toBeLessThan(26)
    })
})
