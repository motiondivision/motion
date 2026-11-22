import { expect, Page, test } from "@playwright/test"

/**
 * Under a MotionConfig with `appear`, motion components start their enter
 * animations as CSS. The dev server renders the page, so they run before
 * the page's code has loaded. When it has, it leaves the CSS animations
 * to run, and only takes a value over for another animation. These hold
 * the page's script back, so it hydrates mid-animation.
 */

const script = /appear-main\.tsx\?hydrate/

async function open(page: Page, url = "appear.html") {
    let release!: VoidFunction
    const held = new Promise<void>((resolve) => (release = resolve))

    const errors: string[] = []
    page.on("console", (message) => {
        ;/hydrat/i.test(message.text()) && errors.push(message.text())
    })
    page.on("pageerror", (error) => errors.push(error.message))

    await page.route(script, async (route) => {
        await held
        await route.continue()
    })

    await page.goto(url, { waitUntil: "commit" })
    await page.waitForSelector("#tween")

    return async () => {
        release()

        // The page marks when it has hydrated
        await page.waitForFunction(
            () => document.body.dataset.code === "ready",
            null,
            { timeout: 5000 }
        )
        expect(errors).toEqual([])
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
    test("run before the page's code has loaded", async ({ page }) => {
        await open(page)
        await page.waitForTimeout(1000)

        // One for opacity, one for translate, and one that holds the
        // transform style at none
        const tween = await read(page, "tween")
        expect(tween.css).toBe(3)

        // A browser without the CSS these need gets none of them
        expect(await page.content()).toContain(
            "@supports not ((translate:0) and (animation-timing-function:linear(0,1))){:root{--m:none}}"
        )

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

    test("keep running as CSS when the page hydrates", async ({ page }) => {
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

    test("hold their targets when the page hydrates late", async ({ page }) => {
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

        // Its target changes 300 ms after the page hydrates
        await arrive()
        const hydrated = await read(page, "changing")
        expect(hydrated.css).toBe(2)
        expect(hydrated.x).toBeGreaterThan(before.x - 1)
        await page.waitForTimeout(450)

        // The animation to the new target starts from there
        const after = await read(page, "changing")
        expect(after.css).toBe(0)
        expect(after.x).toBeGreaterThan(hydrated.x - 1)
        expect(after.x).toBeLessThan(hydrated.x + 80)

        await page.waitForTimeout(4500)
        expect((await read(page, "changing")).x).toBe(200)
    })

    test("all wait for the page's code when CSS can't run one of them", async ({
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

        // They all start together when it arrives
        await arrive()
        expect(warnings.join()).toContain(
            "An enter animation of keyframes of opacity can't run as CSS"
        )
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

    test("are off for a reader who asks for less motion", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" })
        const arrive = await open(page, "appear.html?reduced")
        await page.waitForTimeout(500)

        // Nothing moves as CSS
        const before = await read(page, "tween")
        expect(before.css).toBe(0)
        expect(before.x).toBe(-400)

        // The animation code doesn't animate the transform
        await arrive()
        await page.waitForTimeout(300)
        const after = await read(page, "tween")
        expect(after.css).toBe(0)
        expect(after.x).toBe(0)

        await page.waitForTimeout(4500)
        expect((await read(page, "tween")).opacity).toBe(1)
    })

    test("need the config", async ({ page }) => {
        const arrive = await open(page, "appear.html?off")
        await page.waitForTimeout(500)

        const before = await read(page, "tween")
        expect(before.css).toBe(0)
        expect(before.inline).toBe("")
        expect(before.x).toBe(-400)

        await arrive()
        await page.waitForTimeout(1000)
        const after = await read(page, "tween")
        expect(after.css).toBe(0)
        expect(after.x).toBeGreaterThan(-350)
    })
})
