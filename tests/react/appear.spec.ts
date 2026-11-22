import { expect, Page, test } from "@playwright/test"

/**
 * Motion components from the appear entry start their enter animations as
 * CSS, and fetch their animation code. When it arrives it leaves the CSS
 * animations to run, and only takes a value over for another animation.
 * These hold the animation code back, so it arrives mid-animation.
 */

const animationFile = /animation\/appear\/animations\.mjs/

async function open(page: Page, url = "appear.html") {
    let release!: VoidFunction
    const held = new Promise<void>((resolve) => (release = resolve))

    await page.route(animationFile, async (route) => {
        await held
        await route.continue()
    })

    await page.goto(url)
    await page.waitForSelector("#tween")

    return async () => {
        const loaded = page.waitForResponse(animationFile)
        release()
        await loaded

        // The page marks the first animation the animation code starts
        await page.waitForFunction(
            () => document.body.dataset.code === "ready",
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

        /**
         * A transform of only x, y, z, scale and rotate animates as the
         * properties of those names.
         */
        const translate = parseFloat(style.translate) || 0
        const scale = style.scale === "none" ? 1 : parseFloat(style.scale)

        return {
            x: matrix.m41 + translate,
            scale: matrix.a * scale,
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

        // One for opacity, one for translate, and one that holds the
        // transform style at none
        const tween = await read(page, "tween")
        expect(tween.css).toBe(3)

        // The elements carry no id attribute
        expect(await page.locator("[data-framer-appear-id]").count()).toBe(0)

        // Scale has its own timing, and is done while x is still moving
        const independent = await read(page, "independent")
        expect(independent.scale).toBeCloseTo(1, 2)
        expect(independent.x).toBeGreaterThan(-350)
        expect(independent.x).toBeLessThan(-150)

        expect(tween.opacity).toBeGreaterThan(0.15)
        expect(tween.opacity).toBeLessThan(0.6)
        expect(tween.x).toBeGreaterThan(-350)
        expect(tween.x).toBeLessThan(-150)

        // The default spring of x is done in under a second
        expect(Math.abs((await read(page, "spring")).x)).toBeLessThan(5)
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
        expect(after.css).toBe(3)
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
    })

    test("hand a value to another animation from where it is", async ({
        page,
    }) => {
        const arrive = await open(page)
        await page.waitForTimeout(500)
        await arrive()

        const before = await read(page, "hover")
        expect(before.css).toBe(3)
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

    test("start from what the element shows when the target has changed", async ({
        page,
    }) => {
        const arrive = await open(page)
        await page.waitForTimeout(1000)

        // The CSS animation still goes to the target it mounted with
        const before = await read(page, "changing")
        expect(before.css).toBe(2)
        expect(before.x).toBeGreaterThan(-350)
        expect(before.x).toBeLessThan(-150)

        await arrive()
        await page.waitForTimeout(100)

        // The animation to the new target starts from there
        const after = await read(page, "changing")
        expect(after.css).toBe(0)
        expect(after.x).toBeGreaterThan(before.x - 1)
        expect(after.x).toBeLessThan(before.x + 80)

        await page.waitForTimeout(4500)
        expect((await read(page, "changing")).x).toBe(200)
    })

    test("gestures change the element at once before the animation code", async ({
        page,
    }) => {
        const arrive = await open(page)
        await page.waitForTimeout(300)

        const hover = async () => {
            const box = (await page.locator("#hover").boundingBox())!
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
            await page.waitForTimeout(100)
        }

        const before = await read(page, "hover")
        await hover()

        // The gesture's value shows, and x carries on as CSS
        const hovered = await read(page, "hover")
        expect(hovered.scale).toBe(2)
        expect(hovered.css).toBe(3)
        expect(hovered.x).toBeGreaterThan(before.x)

        // When the gesture ends the enter animation shows again
        await page.mouse.move(0, 0)
        await page.waitForTimeout(100)
        const left = await read(page, "hover")
        expect(left.scale).toBeGreaterThan(before.scale)
        expect(left.scale).toBeLessThan(0.7)
        expect(left.x).toBeGreaterThan(hovered.x)

        // A gesture that is active when the animation code arrives
        // stays, and x carries on from where it is
        await hover()
        const held = await read(page, "hover")
        await arrive()
        await page.waitForTimeout(100)
        const after = await read(page, "hover")
        expect(after.scale).toBe(2)
        expect(after.x).toBeGreaterThan(held.x - 1)
        expect(after.x).toBeLessThan(held.x + 80)

        await page.mouse.move(0, 0)
        await page.waitForTimeout(4500)
        const end = await read(page, "hover")
        expect(end.x).toBe(0)
        expect(end.scale).toBe(1)
        expect(end.css).toBe(0)
    })

    test("all wait for the animation code when CSS can't run one of them", async ({
        page,
    }) => {
        const warnings: string[] = []
        page.on("console", (message) => {
            message.type() === "warning" && warnings.push(message.text())
        })

        const arrive = await open(page, "appear.html?keyframes")
        await page.waitForTimeout(1000)

        // No element of the page has started, in CSS or otherwise
        for (const id of ["tween", "independent", "spring", "hover"]) {
            const { css, x } = await read(page, id)
            expect(css).toBe(0)
            expect(x).toBe(-400)
        }
        expect((await read(page, "tween")).opacity).toBe(0)
        expect((await read(page, "colour")).red).toBe(255)
        expect((await read(page, "keyframes")).opacity).toBe(0)

        expect(warnings.join()).toContain(
            "An enter animation of keyframes of opacity can't run as CSS"
        )

        // They all start together when it arrives
        await arrive()
        await page.waitForTimeout(1000)
        const tween = await read(page, "tween")
        const keyframes = await read(page, "keyframes")
        expect(tween.css).toBe(0)
        expect(tween.inline).toBe("")
        expect(tween.opacity).toBeGreaterThan(0.15)
        expect(tween.opacity).toBeLessThan(0.45)
        // The keyframes are at the same point of the same time
        expect(keyframes.opacity).toBeGreaterThan(tween.opacity - 0.03)
        expect(keyframes.opacity).toBeLessThan(tween.opacity + 0.03)

        await page.waitForTimeout(3500)
        const end = await read(page, "tween")
        expect(end.opacity).toBe(1)
        expect(end.x).toBe(0)
        expect((await read(page, "keyframes")).opacity).toBe(1)
    })
})
