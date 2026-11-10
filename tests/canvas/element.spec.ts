import { expect, test } from "@playwright/test"

/**
 * <motion-canvas> is at (50, 40) on the page, 400 x 300 CSS pixels. #card
 * is 100 x 60 and red. #button is 120 x 40, blue, and drawn through an
 * "invert" shader, so yellow.
 */
const left = 50
const top = 40

test.describe("<motion-canvas>", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("canvas/element.html")
        await page.waitForFunction(() => (window as any).ready)
    })

    test("draws its children without moving them in the DOM", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const w = window as any
            await w.animate("#card", { x: 200, y: 100 }, { duration: 0 })
            // The jump is motion blurred for one frame
            await w.nextRender()
            const px = await w.nextRender()
            return {
                supported: w.host.supported,
                parent: w.card.parentNode === w.host,
                canvas: !!w.host.shadowRoot.querySelector("canvas"),
                drawn: px.at(250, 130),
                empty: px.at(350, 20),
                transform: w.card.style.transform,
            }
        })
        expect(result.supported).toBe(true)
        expect(result.parent).toBe(true)
        expect(result.canvas).toBe(true)
        expect(result.drawn).toEqual([255, 0, 0, 255])
        expect(result.empty[3]).toBe(0)
    })

    test("a real click hits a child where it's drawn", async ({ page }) => {
        await page.evaluate(async () => {
            const w = window as any
            await w.animate("#button", { x: 220, y: 200 }, { duration: 0 })
            await w.nextRender()
            await w.nextRender()
        })
        await page.mouse.click(left + 280, top + 220)
        expect(await page.evaluate(() => (window as any).clicks)).toBe(1)
        // Its layout box at the canvas origin no longer takes the click
        await page.mouse.click(left + 150, top + 20)
        expect(await page.evaluate(() => (window as any).clicks)).toBe(1)
    })

    test("reads motion-blur and samples from attributes", async ({ page }) => {
        const result = await page.evaluate(() => {
            const { host } = window as any
            const before = [host.layer.motionBlur, host.layer.samples]
            host.setAttribute("motion-blur", "1")
            host.removeAttribute("samples")
            return [before, [host.layer.motionBlur, host.layer.samples]]
        })
        expect(result).toEqual([
            [0.5, 12],
            [1, 24],
        ])
    })

    test("a shader attribute names a registered shader", async ({ page }) => {
        const pixel = await page.evaluate(async () => {
            const w = window as any
            await w.animate("#button", { x: 200, y: 200 }, { duration: 0 })
            await w.nextRender()
            return (await w.nextRender()).at(205, 205)
        })
        // Blue, inverted
        expect(pixel).toEqual([255, 255, 0, 255])
    })

    test("follows children as they're added and removed", async ({ page }) => {
        const result = await page.evaluate(async () => {
            const w = window as any
            const late = document.createElement("div")
            late.id = "late"
            w.host.appendChild(late)
            await new Promise((resolve) => setTimeout(resolve, 50))
            await w.animate(late, { x: 300, y: 200 }, { duration: 0 })
            await w.nextRender()
            const added = (await w.nextRender()).at(320, 220)
            late.remove()
            await new Promise((resolve) => setTimeout(resolve, 50))
            const removed = (await w.nextRender()).at(320, 220)
            return { added, removed, has: w.host.layer.has(late) }
        })
        expect(result.added).toEqual([0, 255, 0, 255])
        expect(result.removed[3]).toBe(0)
        expect(result.has).toBe(false)
    })
})

test("without HTML-in-canvas, <motion-canvas> shows its children as normal DOM", async ({
    page,
}) => {
    await page.goto("canvas/element.html?noshim")
    await page.waitForFunction(() => (window as any).ready)

    const result = await page.evaluate(() => {
        const w = window as any
        const rect = w.card.getBoundingClientRect()
        return {
            supported: w.host.supported,
            layer: w.host.layer,
            canvas: !!w.host.shadowRoot.querySelector("canvas"),
            rect: [rect.left, rect.top, rect.width, rect.height],
            hit: document.elementFromPoint(rect.left + 5, rect.top + 5)?.id,
            visible: getComputedStyle(w.card).visibility,
        }
    })
    expect(result).toEqual({
        supported: false,
        layer: undefined,
        canvas: false,
        rect: [left, top, 100, 60],
        hit: "card",
        visible: "visible",
    })

    await page.mouse.click(left + 20, top + 80)
    expect(await page.evaluate(() => (window as any).clicks)).toBe(1)
})
