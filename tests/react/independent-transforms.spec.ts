import { expect, Page, test } from "@playwright/test"

/**
 * Independent transforms (x, y, scale, rotate) accelerate through the
 * individual translate, scale and rotate CSS properties. These tests run
 * in Chromium so they can inspect the native animations themselves.
 */

const readBox = (page: Page, id = "box") =>
    page.evaluate((id) => {
        const box = document.getElementById(id)!
        const computed = getComputedStyle(box)
        return {
            animations: box.getAnimations().map((animation) => ({
                currentTime: Number(animation.currentTime),
                playState: animation.playState,
                playbackRate: animation.playbackRate,
                iterations: animation.effect!.getComputedTiming().iterations,
                keyframes: (animation.effect as KeyframeEffect).getKeyframes(),
            })),
            translate: computed.translate,
            scale: computed.scale,
            rotate: computed.rotate,
            transform: box.style.transform,
            left: box.getBoundingClientRect().left,
        }
    }, id)

const readResult = async (page: Page) => {
    await page.waitForFunction(
        () => document.getElementById("result")!.textContent !== ""
    )
    return JSON.parse((await page.textContent("#result"))!)
}

test.describe("independent transform acceleration", () => {
    test("x, y, scale and rotate run as three accelerated animations", async ({
        page,
    }) => {
        await page.goto("?test=independent-transforms")
        await page.waitForTimeout(5000)

        const box = await readBox(page)

        expect(box.animations.length).toBe(3)
        expect(box.transform).toBe("none")

        const properties = box.animations.map(({ keyframes }) =>
            Object.keys(keyframes[0]).find(
                (k) =>
                    k !== "offset" &&
                    k !== "easing" &&
                    k !== "composite" &&
                    k !== "computedOffset"
            )
        )
        expect(properties.sort()).toEqual(["rotate", "scale", "translate"])

        /**
         * Two keyframes per property with the easing on the animation.
         */
        for (const animation of box.animations) {
            expect(animation.keyframes.length).toBe(2)
        }

        // 50% through a linear 10s animation
        const [x, y] = box.translate.split(" ").map(parseFloat)
        expect(x).toBeGreaterThan(40)
        expect(x).toBeLessThan(60)
        expect(y).toBeGreaterThan(20)
        expect(y).toBeLessThan(30)
        expect(parseFloat(box.scale)).toBeGreaterThan(1.4)
        expect(parseFloat(box.scale)).toBeLessThan(1.6)
        expect(parseFloat(box.rotate)).toBeGreaterThan(40)
        expect(parseFloat(box.rotate)).toBeLessThan(50)
    })

    test("starting scale mid-flight keeps the x animation running natively", async ({
        page,
    }) => {
        await page.goto("?test=independent-transforms-interrupt")
        await page.waitForTimeout(2000)

        const result = await page.evaluate(() => {
            const box = document.getElementById("box")!
            const animations = box.getAnimations()
            const xAnimation = (window as any).xAnimation as Animation
            return {
                count: animations.length,
                sameAnimation: animations.includes(xAnimation),
                xTime: Number(xAnimation.currentTime),
                translate: getComputedStyle(box).translate,
                scale: getComputedStyle(box).scale,
            }
        })

        expect(result.count).toBe(2)
        expect(result.sameAnimation).toBe(true)
        expect(result.xTime).toBeGreaterThan(1700)
        expect(parseFloat(result.translate)).toBeGreaterThan(30)
        expect(parseFloat(result.scale)).toBeGreaterThan(1.05)
    })

    test("interrupting one of two values on a property continues both on the main thread", async ({
        page,
    }) => {
        await page.goto("?test=independent-transforms-demote")
        const result = await readResult(page)

        expect(result.animations).toBe(0)
        // No frame jumped back towards the origin
        expect(result.minOffset).toBeGreaterThan(5)
        // y carried on from where the accelerated animation left it
        expect(result.y).toBeGreaterThan(12)
        // Nothing is accelerated any more, so the element renders through
        // the transform shorthand again
        expect(result.transform).toContain("translateY(")
    })

    test("pause, seek and speed control the native animation", async ({
        page,
    }) => {
        await page.goto("?test=independent-transforms-controls")
        const result = await readResult(page)

        expect(result).toEqual({
            animations: 1,
            paused: "paused",
            currentTime: 5000,
            playbackRate: 2,
            playing: "running",
            sameAnimation: true,
        })
    })

    test("interrupting with a spring carries velocity", async ({ page }) => {
        await page.goto("?test=independent-transforms-velocity")
        const result = await readResult(page)

        expect(result.maxOffset).toBeGreaterThan(result.interruptedAt + 5)
        expect(result.left).toBeLessThan(result.interruptedAt)
    })

    test("layout, transformTemplate and perspective stay on the main thread", async ({
        page,
    }) => {
        await page.goto("?test=independent-transforms-fallback")
        await page.waitForTimeout(1000)

        const layout = await readBox(page, "layout")
        expect(layout.animations.length).toBe(0)
        expect(layout.transform).toContain("translateX")

        const template = await readBox(page, "template")
        expect(template.animations.length).toBe(0)
        expect(template.transform).toContain("skewX")

        const perspective = await readBox(page, "perspective")
        expect(perspective.animations.length).toBe(0)
        expect(perspective.transform).toContain("perspective")

        const repeat = await readBox(page, "repeat")
        expect(repeat.animations.length).toBe(1)
        expect(repeat.animations[0].iterations).toBe(Infinity)
    })
})
