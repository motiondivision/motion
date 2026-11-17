import { expect, Page, test } from "@playwright/test"

/**
 * A spring comes to rest within a distance and speed of its target that
 * are measured in the value's own units. So how long it takes depends on
 * how far it moves, whichever thread plays it.
 */

const readTransform = (page: Page, id: string) =>
    page.evaluate((id) => {
        const { m41, m42 } = new DOMMatrixReadOnly(
            getComputedStyle(document.getElementById(id)!).transform
        )
        return { x: m41, y: m42 }
    }, id)

const duration = (page: Page, name: string) =>
    page.evaluate((name) => (window as any)[name].duration, name)

const expected = (page: Page) =>
    page.evaluate(
        () => (window as any).expected as { far: number; near: number }
    )

/**
 * Hold an animation a moment before its end.
 */
const seekNearEnd = async (page: Page, name: string) => {
    await page.evaluate((name) => {
        const animation = (window as any)[name]
        animation.pause()
        animation.time = animation.duration - 0.02
    }, name)
    await page.waitForTimeout(100)
}

test.describe("animate() transform springs", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("animate/animate-spring-distance.html")
        await page.waitForFunction(() => (window as any).both)
    })

    test("a long move takes as long as its spring does", async ({ page }) => {
        const { far } = await expected(page)
        expect(far).toBeGreaterThan(1.5)
        expect(await duration(page, "far")).toBeCloseTo(far, 2)
    })

    test("a short move takes as long as its spring does", async ({ page }) => {
        const { near } = await expected(page)
        expect(await duration(page, "near")).toBeCloseTo(near, 2)
    })

    test("a long move has come to rest when it ends", async ({ page }) => {
        await seekNearEnd(page, "far")
        const { x } = await readTransform(page, "far")
        expect(Math.abs(x - 3000)).toBeLessThan(2)
    })

    test("two distances on one element both come to rest", async ({
        page,
    }) => {
        const { far } = await expected(page)
        expect(await duration(page, "both")).toBeCloseTo(far, 2)

        await seekNearEnd(page, "both")
        const { x, y } = await readTransform(page, "both")
        expect(Math.abs(x - 3000)).toBeLessThan(2)
        expect(Math.abs(y - 10)).toBeLessThan(0.1)
    })
})
