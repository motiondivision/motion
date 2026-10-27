import { expect, Page, test } from "@playwright/test"

/**
 * #4022: an element looping rotateY on the compositor mustn't be measured
 * for layout with its rotation applied. That box isn't its layout, so it
 * would get a layout animation, with its own infinite transition, that
 * distorts every rotation after.
 */

/**
 * Record the transform Motion renders for a second. With no layout change,
 * projection adds no scale or x/y translate to it.
 */
async function expectUndistorted(page: Page) {
    const transforms: string[] = await page.evaluate(async () => {
        const element = document.getElementById("pack")!
        const recorded: string[] = []
        const start = performance.now()
        while (performance.now() - start < 1000) {
            await new Promise(requestAnimationFrame)
            recorded.push(element.style.transform)
        }
        return recorded
    })

    expect(transforms.length).toBeGreaterThan(10)
    for (const transform of transforms) {
        expect(transform).not.toContain("scale")
        expect(transform).not.toMatch(/translate3d\((?!0px, 0px)/)
    }
}

const countTransformAnimations = (page: Page) =>
    page.evaluate(
        () =>
            document
                .getElementById("pack")!
                .getAnimations()
                .filter((animation) =>
                    (animation.effect as KeyframeEffect)
                        .getKeyframes()
                        .some((keyframe) => "transform" in keyframe)
                ).length
    )

test.describe("layout measurements of a looping 3D rotation", () => {
    test.use({ viewport: { width: 1000, height: 700 } })

    test("a sibling's layout update doesn't distort it", async ({ page }) => {
        await page.goto("?test=layout-sibling-rotating-3d&later")
        await page.waitForSelector("#pack")
        await page.waitForTimeout(100)
        await page.evaluate(() => (window as any).spin())

        // Part way through a rotation, so its box is narrower than its layout.
        await page.waitForTimeout(1300)
        expect(await countTransformAnimations(page)).toBe(1)

        await page.hover("#button")
        await expectUndistorted(page)
    })

    test("unmounting doesn't distort it", async ({ page }) => {
        /**
         * Strict Mode unmounts the layoutId element once it's started
         * rotating, which snapshots it for the remount to resume from.
         */
        await page.goto("?test=layout-sibling-rotating-3d")
        await page.waitForSelector("#pack")
        await page.waitForTimeout(300)
        await expectUndistorted(page)
    })
})
