import { type CDPSession, expect, type Page, test } from "@playwright/test"

/**
 * Runs the example through react-native-web. On the web Reanimated runs
 * worklets on the main thread, so this checks what Motion renders, not
 * that it plays off the JS thread.
 */

interface Values {
    x: number
    scale: number
    rotate: number
    opacity: number
    backgroundColor: string
}

const read = (page: Page, testID: string): Promise<Values> =>
    page.getByTestId(testID).evaluate((element) => {
        const style = getComputedStyle(element)
        const matrix = new DOMMatrix(
            style.transform === "none" ? undefined : style.transform
        )
        return {
            x: matrix.m41,
            scale: Math.hypot(matrix.a, matrix.b),
            rotate: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI,
            opacity: Number(style.opacity),
            backgroundColor: style.backgroundColor,
        }
    })

const sessions = new WeakMap<Page, CDPSession>()

/**
 * The tap gesture listens to touch events, which a mouse doesn't fire.
 */
async function touch(page: Page, testID: string, type: "touchStart" | "touchEnd") {
    const box = (await page.getByTestId(testID).boundingBox())!
    if (!sessions.has(page)) {
        sessions.set(page, await page.context().newCDPSession(page))
    }
    await sessions.get(page)!.send("Input.dispatchTouchEvent", {
        type,
        touchPoints:
            type === "touchStart"
                ? [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }]
                : [],
    })
}

let errors: string[]

test.use({ hasTouch: true })

test.beforeEach(async ({ page }) => {
    errors = []
    page.on("pageerror", (error) => errors.push(error.message))
    page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text())
    })
    await page.goto("/")
    await page.getByTestId("toggle").waitFor()
})

test.afterEach(() => {
    expect(errors).toEqual([])
})

test("entrance animates to its target", async ({ page }) => {
    await expect
        .poll(async () => (await read(page, "entrance")).scale)
        .toBeCloseTo(1, 2)
    expect((await read(page, "entrance")).opacity).toBeCloseTo(1, 2)
})

test("animate moves between targets", async ({ page }) => {
    await page.getByTestId("Toggle").click()
    await page.waitForTimeout(150)
    const mid = await read(page, "toggle")
    expect(mid.x).toBeGreaterThan(1)
    expect(mid.x).toBeLessThan(199)

    await expect.poll(async () => (await read(page, "toggle")).x).toBeCloseTo(200, 0)
    expect(Math.abs((await read(page, "toggle")).rotate)).toBeCloseTo(180, 0)
})

test("interrupting continues from the current value", async ({ page }) => {
    /**
     * Record x every frame while the animation is reversed mid-flight. A
     * jump would show up as one frame moving much further than its
     * neighbours.
     */
    await page.evaluate(() => {
        const element = document.querySelector('[data-testid="toggle"]')!
        const xs: number[] = ((window as any).xs = [])
        const record = () => {
            xs.push(new DOMMatrix(getComputedStyle(element).transform).m41)
            requestAnimationFrame(record)
        }
        requestAnimationFrame(record)
    })

    await page.getByTestId("Toggle").click()
    await page.waitForTimeout(250)
    await page.getByTestId("Toggle").click()
    await expect.poll(async () => (await read(page, "toggle")).x).toBeCloseTo(0, 0)

    const xs: number[] = await page.evaluate(() => (window as any).xs)
    const peak = Math.max(...xs)
    const steps = xs.slice(1).map((x, i) => Math.abs(x - xs[i]))
    const turn = xs.indexOf(peak)
    const typical = Math.max(...steps.slice(turn - 6, turn - 1))

    expect(peak).toBeGreaterThan(40)
    expect(peak).toBeLessThan(199)
    expect(Math.max(...steps.slice(turn - 1, turn + 2))).toBeLessThan(
        typical * 1.5 + 1
    )
})

test("whileTap animates while pressed", async ({ page }) => {
    await touch(page, "tap", "touchStart")
    await expect.poll(async () => (await read(page, "tap")).scale).toBeCloseTo(0.8, 2)
    await expect
        .poll(async () => (await read(page, "tap")).backgroundColor)
        .toBe("rgb(255, 0, 136)")

    await touch(page, "tap", "touchEnd")
    await expect.poll(async () => (await read(page, "tap")).scale).toBeCloseTo(1, 2)
    await expect
        .poll(async () => (await read(page, "tap")).backgroundColor)
        .toBe("rgb(141, 240, 204)")
})

test("repeat: Infinity keeps looping", async ({ page }) => {
    const first = (await read(page, "loader")).rotate
    await page.waitForTimeout(250)
    expect((await read(page, "loader")).rotate).not.toBeCloseTo(first, 0)
})

test("variants stagger children", async ({ page }) => {
    await page.getByTestId("Replay").click()
    await page.waitForTimeout(150)
    const first = await read(page, "stagger-0")
    const last = await read(page, "stagger-3")
    expect(first.opacity).toBeGreaterThan(last.opacity)

    await expect.poll(async () => (await read(page, "stagger-3")).opacity).toBeCloseTo(1, 2)
})

test("AnimatePresence animates exit, then removes", async ({ page }) => {
    await page.getByTestId("Remove").click()
    await page.waitForTimeout(100)
    expect((await read(page, "presence-2")).opacity).toBeLessThan(1)

    await expect(page.getByTestId("presence-2")).toHaveCount(0)
    await expect(page.getByTestId(/^presence-/)).toHaveCount(2)

    await page.getByTestId("Add").click()
    await expect.poll(async () => (await read(page, "presence-2")).opacity).toBeCloseTo(1, 2)
})
