import { expect, Page, test } from "@playwright/test"
import { dragBy, dragFromTo, events, frames, rect } from "./drag-helpers"

/**
 * Vanilla equivalents of packages/framer-motion/cypress/integration/drag-svg.ts
 * and drag-svg-viewbox.ts.
 */

const open = async (page: Page, query = "") => {
    await page.goto(`gestures/drag-svg.html${query}`)
    await frames(page, 2)
}

const position = async (page: Page) => {
    const { left, top } = await rect(page, "#box")
    return { left, top }
}

test.describe("drag: SVG", () => {
    // The circle's bounding box starts at (30, 30)

    test("drags an SVG element by the pointer distance", async ({ page }) => {
        await open(page)
        expect(await position(page)).toEqual({ left: 30, top: 30 })
        await dragBy(page, "#box", 170, 270)
        expect(await position(page)).toEqual({ left: 200, top: 300 })
        expect(await events(page)).toEqual(["start", "end"])
    })

    test("locks drag to x", async ({ page }) => {
        await open(page, "?axis=x")
        await dragBy(page, "#box", 170, 270)
        expect(await position(page)).toEqual({ left: 200, top: 30 })
    })

    test("locks drag to y", async ({ page }) => {
        await open(page, "?axis=y")
        await dragBy(page, "#box", 170, 270)
        expect(await position(page)).toEqual({ left: 30, top: 300 })
    })

    test("constraints as object: bottom right", async ({ page }) => {
        await open(page, "?right=100&bottom=100")
        await dragBy(page, "#box", 200, 200)
        expect(await position(page)).toEqual({ left: 130, top: 130 })
    })

    test("constraints as object: top left", async ({ page }) => {
        await open(page, "?left=-10&top=-10")
        await dragBy(page, "#box", -40, -40)
        expect(await position(page)).toEqual({ left: 20, top: 20 })
    })

    test("direction locks", async ({ page }) => {
        await open(page, "?lock=true")
        await dragFromTo(page, { x: 50, y: 50 }, { x: 50, y: 150 })
        expect(await position(page)).toEqual({ left: 30, top: 130 })
    })
})

/**
 * React compensates for viewBox scaling with
 * <MotionConfig transformPagePoint={transformViewBoxPoint(svgRef)}>.
 * Vanilla drag() has no transformPagePoint option, so only the unscaled
 * case can follow the pointer. The scaled cases are expected to fail
 * until drag() accepts one.
 */
test.describe("drag: SVG with a viewBox", () => {
    const dragAndMeasure = async (page: Page, query: string) => {
        await open(page, `?viewBox=true&${query}`)
        const before = await position(page)
        await dragBy(page, "#box", 100, 100, { x: 10, y: 10 })
        const after = await position(page)
        return { x: after.left - before.left, y: after.top - before.top }
    }

    test("follows the pointer when the viewBox matches the rendered size", async ({
        page,
    }) => {
        const moved = await dragAndMeasure(
            page,
            "viewBoxWidth=500&viewBoxHeight=500&svgWidth=500&svgHeight=500"
        )
        expect(moved.x).toBeCloseTo(100, 0)
        expect(moved.y).toBeCloseTo(100, 0)
    })

    test("follows the pointer when the viewBox is scaled", async ({ page }) => {
        test.fail(true, "Needs transformPagePoint, which drag() lacks")
        const moved = await dragAndMeasure(page, "")
        expect(moved.x).toBeCloseTo(100, 0)
        expect(moved.y).toBeCloseTo(100, 0)
    })

    test("follows the pointer with non-uniform viewBox scaling", async ({
        page,
    }) => {
        test.fail(true, "Needs transformPagePoint, which drag() lacks")
        const moved = await dragAndMeasure(
            page,
            "viewBoxWidth=100&viewBoxHeight=200&svgWidth=500&svgHeight=400"
        )
        expect(moved.x).toBeCloseTo(100, 0)
        expect(moved.y).toBeCloseTo(100, 0)
    })

    test("follows the pointer with a viewBox with a non-zero origin", async ({
        page,
    }) => {
        test.fail(true, "Needs transformPagePoint, which drag() lacks")
        const moved = await dragAndMeasure(
            page,
            "viewBoxX=50&viewBoxY=50&viewBoxWidth=100&viewBoxHeight=100&svgWidth=500&svgHeight=500"
        )
        expect(moved.x).toBeCloseTo(100, 0)
        expect(moved.y).toBeCloseTo(100, 0)
    })
})
