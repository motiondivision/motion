import { expect, Page, test } from "@playwright/test"

/**
 * The canvas is at (50, 40) on the page, 400 x 300 CSS pixels. #card is
 * 100 x 60, red with a 20px green band along its top. #button is 120 x 40
 * and blue, added at x: 150, y: 200. Both are laid out at the canvas'
 * origin, so anything that hits them elsewhere is hitting where they're
 * drawn.
 */
const canvasLeft = 50
const canvasTop = 40

const open = async (page: Page) => {
    await page.goto("canvas/layer.html")
    await page.waitForFunction(() => (window as any).ready)
}

/**
 * The first column on row `y` with a mostly opaque pixel, read in the
 * same paint as the frame is drawn.
 */
const leftEdge = (page: Page, y: number) =>
    page.evaluate(async (row) => {
        const pixels = await (window as any).nextRender()
        return pixels.alphaRow(row).findIndex((alpha: number) => alpha > 128)
    }, y)

test.beforeEach(async ({ page }) => {
    await open(page)
})

test("feature detection finds HTML-in-canvas", async ({ page }) => {
    const { support, supported } = await page.evaluate(() => ({
        support: (window as any).htmlInCanvas,
        supported: (window as any).layer.supported,
    }))
    // "trial" on Chromium 138-156 behind a flag, "native" from 157
    expect(["trial", "native"]).toContain(support)
    expect(supported).toBe(true)
})

test("draws each element where its values put it", async ({ page }) => {
    const pixels = await page.evaluate(async () => {
        const px = await (window as any).nextRender()
        return {
            band: px.at(50, 5),
            card: px.at(50, 40),
            button: px.at(160, 210),
            empty: px.at(300, 100),
        }
    })
    expect(pixels.band).toEqual([0, 255, 0, 255])
    expect(pixels.card).toEqual([255, 0, 0, 255])
    expect(pixels.button).toEqual([0, 0, 255, 255])
    expect(pixels.empty).toEqual([0, 0, 0, 0])
})

test("animate() moves the drawn element mid-animation", async ({ page }) => {
    await page.evaluate(() => {
        const w = window as any
        w.MotionGlobalConfig.useManualTiming = true
        w.start = w.frameData.timestamp
        w.processFrame(w.start)
        w.animate(
            w.card,
            { x: [0, 200], y: [0, 100] },
            { duration: 10, ease: "linear" }
        )
        w.processFrame(w.start + 5000)
    })

    // Half way: x 100, y 50
    expect(await leftEdge(page, 80)).toBe(100)
    const { band, card, before } = await page.evaluate(async () => {
        const px = await (window as any).nextRender()
        return {
            band: px.at(150, 55),
            card: px.at(150, 100),
            before: px.at(50, 30),
        }
    })
    expect(band).toEqual([0, 255, 0, 255])
    expect(card).toEqual([255, 0, 0, 255])
    expect(before).toEqual([0, 0, 0, 0])
})

test("draws rotation and keeps the texture the right way up", async ({
    page,
}) => {
    const result = await page.evaluate(async () => {
        const w = window as any
        w.animate(w.card, { x: 200, y: 100, rotate: 90 }, { duration: 0 })
        const px = await w.nextRender()
        return {
            // Rotated 90deg about its centre (250, 130), the card covers
            // x 220-280, y 80-180, and its top edge is now on the right.
            rotatedOnly: px.at(225, 85),
            unrotatedOnly: px.at(290, 130),
            band: px.at(275, 130),
            card: px.at(230, 130),
            transform: w.card.style.transform,
        }
    })

    expect(result.rotatedOnly[3]).toBe(255)
    expect(result.unrotatedOnly).toEqual([0, 0, 0, 0])
    expect(result.band).toEqual([0, 255, 0, 255])
    expect(result.card).toEqual([255, 0, 0, 255])
    // Motion didn't style the element. On the trial build, the shim writes
    // a matrix for hit testing.
    expect(result.transform).not.toMatch(/translate|rotate\(/)
})

test("a real click hits a transformed button where it's drawn", async ({
    page,
}) => {
    await page.evaluate(async () => {
        const w = window as any
        w.animate(w.button, { rotate: 30, scale: 1.2 }, { duration: 0 })
        await w.nextRender()
        await w.nextRender()
    })

    // Inside the button's layout box, but it's not drawn there
    await page.mouse.click(canvasLeft + 110, canvasTop + 30)
    expect(await page.evaluate(() => (window as any).clicks)).toBe(0)

    // The centre of the drawn button
    await page.mouse.click(canvasLeft + 210, canvasTop + 220)
    expect(await page.evaluate(() => (window as any).clicks)).toBe(1)

    // Inside the rotated button, outside where it'd be unrotated
    await page.mouse.click(canvasLeft + 248, canvasTop + 262)
    expect(await page.evaluate(() => (window as any).clicks)).toBe(2)
    expect(await page.textContent("#button")).toBe("2")
})

test("drag() moves the drawn element", async ({ page }) => {
    await page.evaluate(() => {
        const w = window as any
        w.drag(w.card, { momentum: false })
    })

    await page.mouse.move(canvasLeft + 50, canvasTop + 40)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++) {
        await page.mouse.move(canvasLeft + 50 + i * 8, canvasTop + 40 + i * 4)
    }
    await page.mouse.up()

    await page.waitForTimeout(100)
    expect(await leftEdge(page, 70)).toBe(80)

    // And it can be dragged again from where it's drawn now
    await page.mouse.move(canvasLeft + 130, canvasTop + 80)
    await page.mouse.down()
    for (let i = 1; i <= 5; i++) {
        await page.mouse.move(canvasLeft + 130 - i * 8, canvasTop + 80)
    }
    await page.mouse.up()
    await page.waitForTimeout(100)
    expect(await leftEdge(page, 70)).toBe(40)
})

test("hover() and press() follow the drawn element", async ({ page }) => {
    await page.evaluate(async () => {
        const w = window as any
        w.animate(w.card, { x: 200, y: 100 }, { duration: 0 })
        await w.nextRender()
        await w.nextRender()
    })

    // Where the card is laid out, but not drawn
    await page.mouse.move(canvasLeft + 20, canvasTop + 20)
    await page.mouse.move(canvasLeft + 250, canvasTop + 130)
    await page.mouse.move(canvasLeft + 390, canvasTop + 290)

    await page.mouse.move(canvasLeft + 210, canvasTop + 220)
    await page.mouse.down()
    await page.mouse.up()

    expect(await page.evaluate(() => (window as any).events)).toEqual([
        "hover start",
        "hover end",
        "press start",
        "press end",
    ])
})

test("canvasEffect() binds motion values to the drawn element", async ({
    page,
}) => {
    await page.evaluate(() => {
        const w = window as any
        w.x = w.motionValue(0)
        w.stopEffect = w.canvasEffect(w.card, { x: w.x })
        w.x.set(120)
    })
    expect(await leftEdge(page, 40)).toBe(120)

    await page.evaluate(() => (window as any).x.set(60))
    expect(await leftEdge(page, 40)).toBe(60)

    // Unbound, the element stays where it is
    await page.evaluate(() => {
        const w = window as any
        w.stopEffect()
        w.x.set(200)
    })
    expect(await leftEdge(page, 40)).toBe(60)
})
