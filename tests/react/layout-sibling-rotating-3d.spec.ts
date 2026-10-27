import { expect, Page, test } from "@playwright/test"

/**
 * #4022: an element looping rotateY on the compositor mustn't be measured
 * for layout with its rotation applied. That box isn't its layout, so it
 * would get a layout animation, with its own infinite transition, that
 * distorts every rotation after.
 */

/**
 * Record an element's inline transform every frame for a second.
 */
const recordTransforms = (page: Page, id: string): Promise<string[]> =>
    page.evaluate(async (id) => {
        const element = document.getElementById(id)!
        const recorded: string[] = []
        const start = performance.now()
        while (performance.now() - start < 1000) {
            await new Promise(requestAnimationFrame)
            recorded.push(element.style.transform)
        }
        return recorded
    }, id)

/**
 * With no layout change, projection adds no scale or x/y translate to the
 * rotating element, which keeps rotating.
 */
async function expectUndistorted(page: Page) {
    const transforms = await recordTransforms(page, "pack")

    expect(transforms.length).toBeGreaterThan(10)
    for (const transform of transforms) {
        expect(transform).toContain("rotateY(")
        expect(transform).not.toContain("scale")
        expect(transform).not.toMatch(/translate3d\((?!0px, 0px)/)
    }
    expect(transforms[transforms.length - 1]).not.toBe(transforms[0])
}

/**
 * Start the rotation once Strict Mode's remount is over, and wait until
 * it's part way through a loop on the compositor.
 */
async function spin(page: Page, test: string) {
    await page.goto(`?test=${test}&later`)
    await page.waitForSelector("#pack")
    await page.waitForTimeout(100)
    await page.evaluate(() => (window as any).spin())
    await page.waitForTimeout(1300)

    const accelerated = await page.evaluate(
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
    expect(accelerated).toBe(1)
}

test.describe("layout measurements of a looping 3D rotation", () => {
    test.use({ viewport: { width: 1000, height: 700 } })

    test("a sibling's layout update doesn't distort it", async ({ page }) => {
        await spin(page, "layout-sibling-rotating-3d")
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

    test("a child's layout update doesn't distort the child", async ({
        page,
    }) => {
        await spin(page, "layout-ancestor-rotating-3d")
        await page.evaluate(() => (window as any).rerender())

        const transforms = await recordTransforms(page, "child")
        for (const transform of transforms) {
            expect(["", "none"]).toContain(transform)
        }
        await expectUndistorted(page)
    })
})
