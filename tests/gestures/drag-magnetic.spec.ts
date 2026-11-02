import { expect, Page, test } from "@playwright/test"
import { center, events, frames, pressAndMove } from "./drag-helpers"

/**
 * drag() with magnetic() constraints. Card and slots are 80x80. The card's
 * centre starts at (80, 240), slot #a's at (280, 240).
 */

const open = async (page: Page, variant: string) => {
    await page.goto("gestures/drag-magnetic.html")
    await page.click(`[data-variant="${variant}"]`)
    await frames(page, 2)
}

const start = { x: 80, y: 240 }

/**
 * Release once the pointer has been still long enough to carry no
 * velocity, then wait for the card to settle.
 */
async function releaseStill(page: Page) {
    await page.waitForTimeout(150)
    await page.mouse.up()
    await page.waitForFunction(() => (window as any).events.includes("settled"))
}

const round = ({ x, y }: { x: number; y: number }) => ({
    x: Math.round(x),
    y: Math.round(y),
})

test.describe("drag: magnetic", () => {
    test("snap: locks onto a slot, then lets go", async ({ page }) => {
        await open(page, "snap")

        await pressAndMove(page, start, { x: 260, y: 250 })
        await page.waitForTimeout(500)
        expect(round(await center(page, "#card"))).toEqual({ x: 280, y: 240 })
        expect(await events(page)).toEqual(["a"])
        await expect(page.locator("#a")).toHaveClass(/active/)

        // Out of the snap distance and the pull field
        await page.mouse.move(120, 240, { steps: 5 })
        await page.waitForTimeout(500)
        expect(round(await center(page, "#card"))).toEqual({ x: 120, y: 240 })
        expect(await events(page)).toEqual(["a", null])

        await page.mouse.up()
    })

    test("pull: draws the card towards a slot and settles on it", async ({
        page,
    }) => {
        await open(page, "pull")

        await pressAndMove(page, start, { x: 230, y: 240 })

        // 50px from #a: 0.6 * (1 - 50 / 120) ^ 2 of the way
        const k = 0.6 * (1 - 50 / 120) ** 2
        const { x } = await center(page, "#card")
        expect(x).toBeCloseTo(230 + 50 * k, 0)

        await releaseStill(page)
        expect(round(await center(page, "#card"))).toEqual({ x: 280, y: 240 })
    })

    test("release only: follows the pointer, settles on release", async ({
        page,
    }) => {
        await open(page, "release")

        await pressAndMove(page, start, { x: 380, y: 260 })
        expect(round(await center(page, "#card"))).toEqual({ x: 380, y: 260 })

        await releaseStill(page)
        expect(round(await center(page, "#card"))).toEqual({ x: 440, y: 240 })
        expect(await events(page)).toContain("b")
    })

    test("release only: stays put away from every slot", async ({ page }) => {
        await open(page, "release")

        await pressAndMove(page, start, { x: 100, y: 480 })
        await releaseStill(page)
        expect(round(await center(page, "#card"))).toEqual({ x: 100, y: 480 })
    })

    test("a throw carries the card to the slot it's heading for", async ({
        page,
    }) => {
        await open(page, "release")

        // Drag slowly to x = 200, then flick right and release mid-flight
        await pressAndMove(page, start, { x: 200, y: 240 })
        await page.waitForTimeout(150)
        for (let x = 208; x <= 232; x += 8) {
            await page.mouse.move(x, 240)
            await page.waitForTimeout(16)
        }
        await page.mouse.up()
        await page.waitForFunction(() =>
            (window as any).events.includes("settled")
        )

        const { x } = round(await center(page, "#card"))
        expect([440, 600]).toContain(x)
    })
})
