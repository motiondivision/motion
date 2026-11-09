import { expect, Page, test } from "@playwright/test"

/**
 * An inspector behind __MOTION_INSPECT__ is handed each animation as it
 * starts, and controls it: it seeks, pauses and changes its speed.
 */

const readX = (page: Page) =>
    page.evaluate(
        () =>
            new DOMMatrixReadOnly(
                getComputedStyle(document.getElementById("box")!).transform
            ).m41
    )

const readOpacity = (page: Page) =>
    page.evaluate(() =>
        parseFloat(getComputedStyle(document.getElementById("box")!).opacity)
    )

/**
 * Run a control on the latest animation of a value. Returns an error's
 * message if it throws.
 */
const control = (page: Page, name: string, code: string) =>
    page.evaluate(
        ([name, code]) => {
            const record = (window as any).inspected
                .filter((r: any) => r.options.name === name)
                .pop()
            try {
                new Function("animation", code)(record.animation)
            } catch (e) {
                return (e as Error).message
            }
        },
        [name, code]
    )

test.describe("inspector playback of a motion component's animations", () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            const inspected: unknown[] = ((window as any).inspected = [])
            ;(window as any).__MOTION_INSPECT__ = (record: unknown) =>
                inspected.push(record)
        })
        await page.goto("?test=inspect-playback")
        await page.waitForFunction(() => (window as any).inspected.length > 1)
    })

    test("seeks a paused transform", async ({ page }) => {
        expect(
            await control(page, "x", "animation.pause(); animation.time = 5")
        ).toBeUndefined()
        await page.waitForTimeout(100)
        expect(await readX(page)).toBeCloseTo(200, 0)
        await page.waitForTimeout(100)
        expect(await readX(page)).toBeCloseTo(200, 0)
    })

    test("seeks a running transform", async ({ page }) => {
        expect(await control(page, "x", "animation.time = 5")).toBeUndefined()
        await page.waitForTimeout(100)
        const x = await readX(page)
        expect(x).toBeGreaterThan(200)
        expect(x).toBeLessThan(220)
    })

    test("changes the speed of a transform", async ({ page }) => {
        expect(
            await control(page, "x", "animation.time = 2; animation.speed = 2")
        ).toBeUndefined()
        await page.waitForTimeout(500)
        // 500ms at double speed from 2s of 10s over 400px: 120px. At
        // normal speed: 100px.
        const x = await readX(page)
        expect(x).toBeGreaterThan(112)
        expect(x).toBeLessThan(140)
    })

    test("seeks a paused opacity", async ({ page }) => {
        expect(
            await control(
                page,
                "opacity",
                "animation.pause(); animation.time = 5"
            )
        ).toBeUndefined()
        await page.waitForTimeout(100)
        expect(await readOpacity(page)).toBeCloseTo(0.75, 2)
    })
})
