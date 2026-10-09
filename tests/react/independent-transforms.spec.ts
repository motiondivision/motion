import { expect, Page, test } from "@playwright/test"

/**
 * Independent transforms on motion components run as one accelerated
 * WAAPI transform animation per element, except where a value needs the
 * main thread.
 */

const count = (page: Page, id: string) =>
    page.evaluate((id) => (window as any).countTransformAnimations(id), id)

const readX = (page: Page, id: string) =>
    page.evaluate(
        (id) =>
            new DOMMatrixReadOnly(
                getComputedStyle(document.getElementById(id)!).transform
            ).m41,
        id
    )

test.describe("independent transforms on motion components", () => {
    test.use({ viewport: { width: 500, height: 500 } })

    test.beforeEach(async ({ page }) => {
        await page.goto("?test=independent-transforms")
        await page.waitForSelector("#layout")
        await page.waitForTimeout(150)
    })

    test("animate runs as one accelerated animation", async ({ page }) => {
        expect(await count(page, "accelerated")).toBe(1)

        // A gesture joins the same WAAPI animation.
        await page.hover("#accelerated")
        await page.waitForTimeout(100)
        expect(await count(page, "accelerated")).toBe(1)
        const rotate = await page.evaluate(() => {
            const { a, b } = new DOMMatrixReadOnly(
                getComputedStyle(
                    document.getElementById("accelerated")!
                ).transform
            )
            return (Math.atan2(b, a) * 180) / Math.PI
        })
        expect(rotate).toBeGreaterThan(1)
    })

    test("transformTemplate and onUpdate stay on the main thread", async ({
        page,
    }) => {
        expect(await count(page, "template")).toBe(0)
        expect(await count(page, "on-update")).toBe(0)
        expect(await readX(page, "template")).toBeGreaterThan(5)
        expect(await readX(page, "on-update")).toBeGreaterThan(5)
    })

    test("adding transformTemplate moves the element to the main thread", async ({
        page,
    }) => {
        // Accelerated until transformTemplate is added 300ms in.
        expect(await count(page, "late-template")).toBe(1)
        await page.waitForTimeout(300)
        expect(await count(page, "late-template")).toBe(0)
        const { x, rotate } = await page.evaluate(() => {
            const { a, b, m41 } = new DOMMatrixReadOnly(
                getComputedStyle(
                    document.getElementById("late-template")!
                ).transform
            )
            return { x: m41, rotate: (Math.atan2(b, a) * 180) / Math.PI }
        })
        expect(rotate).toBeCloseTo(45, 0)
        expect(x).toBeGreaterThan(30)
    })

    test("an external motion value moves the element to the main thread", async ({
        page,
    }) => {
        await page.waitForTimeout(200)
        expect(await count(page, "external")).toBe(0)
        // Both the external x and the internal scale are visible.
        const { x, scale } = await page.evaluate(() => {
            const matrix = new DOMMatrixReadOnly(
                getComputedStyle(document.getElementById("external")!).transform
            )
            return { x: matrix.m41, scale: matrix.a }
        })
        expect(x).toBeGreaterThan(20)
        expect(scale).toBeGreaterThan(1.1)
    })

    test("a layout animation moves the element to the main thread", async ({
        page,
    }) => {
        // Accelerated until the width changes 300ms in, which starts a
        // layout animation.
        expect(await count(page, "layout")).toBe(1)
        await page.waitForTimeout(300)
        expect(await count(page, "layout")).toBe(0)
        const x = await readX(page, "layout")
        expect(x).toBeGreaterThan(30)
        expect(x).toBeLessThan(80)

        await page.waitForTimeout(800)
        const bounds = await page.locator("#layout").boundingBox()
        expect(bounds!.x).toBeCloseTo(100, 0)
        expect(bounds!.width).toBeCloseTo(200, 0)
    })
})
