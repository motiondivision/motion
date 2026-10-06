import { expect, Page, test } from "@playwright/test"

/**
 * Animating width from px to % needs the element measuring. Interrupting
 * that animation with another % target shouldn't need measuring again,
 * and the width shouldn't jump when it's interrupted.
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

        let measured = 0
        const getComputedStyle = window.getComputedStyle
        window.getComputedStyle = (...args) => {
            measured++
            return getComputedStyle(...args)
        }

        const before = width()
        const latest: string[] = []
        animate(
            element,
            { width: "25%" },
            {
                ...transition,
                onUpdate: (v: string) => latest.push(v),
            }
        )
        await window.nextFrames(2)
        window.getComputedStyle = getComputedStyle
        const after = width()

        await window.wait(1100)
        return { measured, before, after, latest, end: width() }
    }, id)
}

test.describe("animate() width % interrupt", () => {
    test.use({ viewport: { width: 500, height: 500 } })

    test.beforeEach(async ({ page }) => load(page))

    test("doesn't measure again or jump when interrupted", async ({ page }) => {
        const { measured, before, after, latest, end } = await interrupt(
            page,
            "a"
        )

        expect(measured).toBe(0)
        expect(latest[0]).toMatch(/%$/)
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
})
