import { expect, Page, test } from "@playwright/test"

/**
 * Motion components from the appear entry start their enter animations as
 * CSS, and fetch their animation code. When it arrives it leaves the CSS
 * animations to run, and only takes a value over for another animation.
 * These hold the animation code back, so it arrives mid-animation.
 */

const animationFile = /animation\/appear\/animations\.mjs/

async function open(page: Page) {
    let release!: VoidFunction
    const held = new Promise<void>((resolve) => (release = resolve))

    await page.route(animationFile, async (route) => {
        await held
        await route.continue()
    })

    await page.goto("appear.html")
    await page.waitForSelector("#tween")

    return async () => {
        const loaded = page.waitForResponse(animationFile)
        release()
        await loaded

        /**
         * The keyframes can't run as CSS, so they start when the
         * animation code is in use.
         */
        await page.waitForFunction(
            () =>
                getComputedStyle(document.getElementById("keyframes")!)
                    .opacity !== "0",
            null,
            { timeout: 3000 }
        )
    }
}

const read = (page: Page, id: string) =>
    page.evaluate((id) => {
        const element = document.getElementById(id)!
        const style = getComputedStyle(element)
        const matrix = new DOMMatrixReadOnly(style.transform)

        return {
            x: matrix.m41,
            scale: matrix.a,
            opacity: parseFloat(style.opacity),
            red: parseInt(style.backgroundColor.slice(4)),
            css: element
                .getAnimations()
                .filter((animation) => "animationName" in animation).length,
            inline: element.style.animation,
            transform: element.style.transform,
        }
    }, id)

test.describe("CSS appear animations", () => {
    test("run before the animation code has loaded", async ({ page }) => {
        await open(page)
        await page.waitForTimeout(1000)

        const tween = await read(page, "tween")
        expect(tween.css).toBe(2)

        // The elements carry no id attribute
        expect(await page.locator("[data-framer-appear-id]").count()).toBe(0)

        expect(tween.opacity).toBeGreaterThan(0.15)
        expect(tween.opacity).toBeLessThan(0.6)
        expect(tween.x).toBeGreaterThan(-350)
        expect(tween.x).toBeLessThan(-150)

        // The default spring of x is done in under a second
        expect(Math.abs((await read(page, "spring")).x)).toBeLessThan(5)

        // Keyframes wait for the animation code
        const keyframes = await read(page, "keyframes")
        expect(keyframes.css).toBe(0)
        expect(keyframes.opacity).toBe(0)
    })

    test("keep running as CSS when the animation code arrives", async ({
        page,
    }) => {
        const arrive = await open(page)
        await page.waitForTimeout(500)

        const before = await read(page, "tween")
        await arrive()
        await page.waitForTimeout(300)
        const after = await read(page, "tween")

        // The browser still plays them, and Motion hasn't set a style
        expect(after.css).toBe(2)
        expect(after.transform).toBe(before.transform)
        expect(after.opacity).toBeGreaterThan(before.opacity)
        expect(after.x).toBeGreaterThan(before.x)
        expect((await read(page, "colour")).css).toBe(1)

        // At their ends, each value is at its target with no animation
        await page.waitForTimeout(4500)
        const end = await read(page, "tween")
        expect(end.css).toBe(0)
        expect(end.inline).toBe("")
        expect(end.opacity).toBe(1)
        expect(end.x).toBe(0)
        expect(end.transform).toBe("none")
        const colour = await read(page, "colour")
        expect(colour.red).toBe(0)
        expect(colour.inline).toBe("")
        expect((await read(page, "keyframes")).opacity).toBe(1)
    })

    test("hand a value to another animation from where it is", async ({
        page,
    }) => {
        const arrive = await open(page)
        await page.waitForTimeout(500)
        await arrive()

        const before = await read(page, "hover")
        expect(before.css).toBe(1)
        expect(before.scale).toBeLessThan(1)

        const box = (await page.locator("#hover").boundingBox())!
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.waitForTimeout(100)

        // The hover animation starts from the value the browser showed,
        // and x carries on in the animation code
        const after = await read(page, "hover")
        expect(after.css).toBe(0)
        expect(after.scale).toBeGreaterThan(before.scale - 0.01)
        expect(after.scale).toBeLessThan(before.scale + 0.15)
        expect(after.x).toBeGreaterThan(before.x - 1)
        expect(after.x).toBeLessThan(before.x + 40)

        // The scale goes on past the enter animation's target, which
        // the CSS animation never would
        await page.waitForTimeout(1000)
        const later = await read(page, "hover")
        expect(later.scale).toBeGreaterThan(before.scale + 0.2)
        expect(later.x).toBeGreaterThan(after.x)

        // x ends where its enter animation was going
        await page.waitForTimeout(3500)
        expect((await read(page, "hover")).x).toBe(0)
    })

    test("hold their targets when the animation code arrives late", async ({
        page,
    }) => {
        const arrive = await open(page)
        await page.waitForTimeout(4300)

        expect((await read(page, "tween")).opacity).toBe(1)
        await arrive()
        await page.waitForTimeout(300)

        const end = await read(page, "tween")
        expect(end.css).toBe(0)
        expect(end.opacity).toBe(1)
        expect(end.x).toBe(0)
        expect((await read(page, "colour")).red).toBe(0)
    })
})
