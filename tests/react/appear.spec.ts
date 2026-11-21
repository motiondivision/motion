import { expect, Page, test } from "@playwright/test"

/**
 * Motion components from the appear entry start their enter animations as
 * CSS, and the animation code takes them over when `LazyMotion` has loaded
 * it. These hold the animation code back, so it arrives mid-animation.
 */

const featureFiles = {
    "": /framer-motion\/dist\/es\/index\.mjs/,
    "?async": /motion\/features\/animations\.mjs/,
}

async function open(page: Page, query: keyof typeof featureFiles) {
    const featureFile = featureFiles[query]
    let release!: VoidFunction
    const held = new Promise<void>((resolve) => (release = resolve))

    await page.route(featureFile, async (route) => {
        await held
        await route.continue()
    })

    await page.goto("appear.html" + query)
    await page.waitForSelector("#tween")

    return async () => {
        const loaded = page.waitForResponse(featureFile)
        release()
        await loaded

        /**
         * The animation code takes each value over on its first frame,
         * and drops the CSS animation two frames later.
         */
        await page.waitForFunction(
            () =>
                !document
                    .getElementById("tween")!
                    .getAnimations()
                    .some((animation) => "animationName" in animation),
            null,
            { timeout: 3000 }
        )
    }
}

const read = (page: Page, id: string) =>
    page.evaluate((id) => {
        const element = document.getElementById(id)!
        const style = getComputedStyle(element)

        return {
            x: new DOMMatrixReadOnly(style.transform).m41,
            opacity: parseFloat(style.opacity),
            red: parseInt(style.backgroundColor.slice(4)),
            css: element
                .getAnimations()
                .filter((animation) => "animationName" in animation).length,
            inline: element.style.animation,
        }
    }, id)

for (const query of ["", "?async"] as const) {
    test.describe(`CSS appear animations ${
        query ? "with async features" : "with LazyMotion"
    }`, () => {
        test("run before the animation code has loaded", async ({ page }) => {
            await open(page, query)
            await page.waitForTimeout(1000)

            const tween = await read(page, "tween")
            expect(tween.css).toBe(2)
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

        test("carry on in the animation code when it arrives", async ({
            page,
        }) => {
            const arrive = await open(page, query)
            await page.waitForTimeout(800)

            const before = await read(page, "tween")
            const colourBefore = await read(page, "colour")
            await arrive()
            const after = await read(page, "tween")
            const colourAfter = await read(page, "colour")

            // The CSS animations have gone, and the value didn't start again
            expect(after.css).toBe(0)
            expect(after.inline).toBe("")
            expect(after.opacity).toBeGreaterThan(before.opacity)
            expect(after.opacity).toBeLessThan(before.opacity + 0.35)
            expect(after.x).toBeGreaterThan(before.x)
            expect(after.x).toBeLessThan(before.x + 140)

            // A colour stays with the browser, so it doesn't change its mix
            expect(colourAfter.red).toBeLessThan(colourBefore.red)
            expect(colourAfter.red).toBeGreaterThan(colourBefore.red - 90)

            // Keyframes have started
            await page.waitForTimeout(500)
            expect((await read(page, "keyframes")).opacity).toBeGreaterThan(0)

            // At their ends, each value is at its target with no animation
            await page.waitForTimeout(4500)
            const end = await read(page, "tween")
            expect(end.opacity).toBe(1)
            expect(end.x).toBe(0)
            const colour = await read(page, "colour")
            expect(colour.red).toBe(0)
            expect(colour.inline).toBe("")
        })

        test("hold their targets when the animation code arrives late", async ({
            page,
        }) => {
            const arrive = await open(page, query)
            await page.waitForTimeout(4300)

            expect((await read(page, "tween")).opacity).toBe(1)
            await arrive()

            const end = await read(page, "tween")
            expect(end.css).toBe(0)
            expect(end.opacity).toBe(1)
            expect(end.x).toBe(0)
            expect((await read(page, "colour")).red).toBe(0)
        })
    })
}
