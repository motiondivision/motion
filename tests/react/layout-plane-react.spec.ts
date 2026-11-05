import { expect, Page, test } from "@playwright/test"

/**
 * A React layoutId card and a three.js layout plane hand over to each
 * other in both directions. dev/react/src/tests/layout-plane-react.tsx.
 */

const read = (page: Page) =>
    page.evaluate(() => {
        const card = document.getElementById("card")
        const { mesh } = (window as any).scene
        return {
            card: card?.style.transform ?? null,
            cardOpacity: card ? Number(getComputedStyle(card).opacity) : null,
            meshVisible: mesh.visible,
            meshOpacity: mesh.material.opacity,
            projected: !mesh.matrixWorldAutoUpdate,
        }
    })

test.describe("layout planes in React", () => {
    test("a card leaves the page for the scene", async ({ page }) => {
        await page.goto("?test=layout-plane-react")
        await page.waitForSelector("#card")
        await page.waitForTimeout(300)
        expect((await read(page)).meshVisible).toBe(false)

        await page.evaluate(() => (window as any).toggle())
        await page.waitForTimeout(3000)
        const mid = await read(page)

        // The plane is drawn where Motion places it, mid-flight.
        expect(mid.card).toBe(null)
        expect(mid.meshVisible).toBe(true)
        expect(mid.projected).toBe(true)
    })

    test("a plane leaves the scene for the page, crossfading", async ({
        page,
    }) => {
        await page.goto("?test=layout-plane-react&scene")
        await page.waitForFunction(() => (window as any).toggle)
        await page.waitForTimeout(800)
        expect((await read(page)).meshVisible).toBe(true)

        await page.evaluate(() => (window as any).toggle())
        await page.waitForTimeout(2000)
        const early = await read(page)
        await page.waitForTimeout(5000)
        const late = await read(page)

        // The card follows a quad from the plane, so it's drawn as matrix3d.
        expect(early.card).toContain("matrix3d(")
        expect(early.projected).toBe(true)

        // The card fades in while the plane, still following it, fades out.
        expect(early.cardOpacity!).toBeGreaterThan(0)
        expect(early.cardOpacity!).toBeLessThan(late.cardOpacity!)
        expect(late.meshOpacity).toBeLessThan(1)
        expect(late.meshVisible).toBe(true)
    })
})
