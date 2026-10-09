import { expect, Page, test } from "@playwright/test"

/**
 * Animating width from px to % needs the element measuring. The width
 * shouldn't jump when it starts, or when another % target interrupts it.
 */

declare global {
    interface Window {
        Motion: any
        nextFrames: (count?: number) => Promise<void>
        wait: (ms: number) => Promise<void>
    }
}

async function load(page: Page) {
    await page.goto("animate/animate-width-percent-interrupt.html")
    await page.waitForFunction(() => (window as any).ready)
}

async function interrupt(page: Page, id: string) {
    return page.evaluate(async (id) => {
        const { animate } = window.Motion
        const element = document.getElementById(id)!
        const width = () => element.getBoundingClientRect().width
        const transition = { duration: 1, ease: "linear" }

        animate(element, { width: "100%" }, transition)
        await window.wait(500)

        const before = width()
        animate(element, { width: "25%" }, transition)
        await window.nextFrames(2)
        const after = width()

        await window.wait(1100)
        return { before, after, end: width() }
    }, id)
}

test.describe("animate() width % interrupt", () => {
    test.use({ viewport: { width: 500, height: 500 } })

    test.beforeEach(async ({ page }) => load(page))

    test("doesn't jump when interrupted", async ({ page }) => {
        const { before, after, end } = await interrupt(page, "a")

        expect(before).toBeGreaterThan(150)
        expect(before).toBeLessThan(260)
        expect(Math.abs(after - before)).toBeLessThan(20)
        expect(end).toBeCloseTo(100, 0)
    })

    test("doesn't jump when max-width clamps the target", async ({ page }) => {
        const { before, after, end } = await interrupt(page, "clamped")

        expect(before).toBeGreaterThan(60)
        expect(before).toBeLessThan(110)
        expect(Math.abs(after - before)).toBeLessThan(20)
        expect(end).toBeCloseTo(100, 0)
    })

    test("doesn't jump with border-box padding", async ({ page }) => {
        const { before, after, end } = await interrupt(page, "padded")

        expect(before).toBeGreaterThan(150)
        expect(before).toBeLessThan(260)
        expect(Math.abs(after - before)).toBeLessThan(20)
        expect(end).toBeCloseTo(100, 0)
    })

    test("doesn't jump when flex shrinks the target", async ({ page }) => {
        const widths = await page.evaluate(async () => {
            const element = document.getElementById("flex")!
            const width = () => element.getBoundingClientRect().width
            window.Motion.animate(
                element,
                { width: "100%" },
                { duration: 1, ease: "linear" }
            )
            const widths = [width()]
            for (let i = 0; i < 3; i++) {
                await window.nextFrames(1)
                widths.push(width())
            }
            return widths
        })

        for (const width of widths) {
            expect(width).toBeGreaterThan(99)
            expect(width).toBeLessThan(110)
        }
    })
})
