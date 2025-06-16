import { expect, test } from "@playwright/test"

test.describe("svgEffect", () => {
    test("draws pathLength as stroke-dasharray", async ({ page }) => {
        await page.goto("effects/path-length.html")
        const path = page.locator("#tick")
        const strokeDasharray = await path.getAttribute("stroke-dasharray")
        expect(strokeDasharray).toBe("0.25px 0.75px")
        const pathLength = await path.getAttribute("pathLength")
        expect(pathLength).toBe("1")
    })

    test("draws pathOffset as stroke-dashoffset", async ({ page }) => {
        await page.goto("effects/path-offset.html")
        const path = page.locator("#tick")
        const strokeDashoffset = await path.getAttribute("stroke-dashoffset")
        expect(strokeDashoffset).toBe("-0.5px")
    })

    test("ensures default pathSpacing correctly creates looping effect by calculating remaining amount", async ({
        page,
    }) => {
        await page.goto("effects/path-offset-loop.html")
        const circle = page.locator("#circle")
        const strokeDasharray = await circle.getAttribute("stroke-dasharray")
        expect(strokeDasharray).toBe("0.5px 0.5px")
        const strokeDashoffset = await circle.getAttribute("stroke-dashoffset")
        expect(strokeDashoffset).toBe("-0.75px")
    })

    test("draws attrX as x", async ({ page }) => {
        await page.goto("effects/attr.html")
        const circle = page.locator("#circle")
        const x = await circle.getAttribute("x")
        expect(x).toBe("100px")
    })

    test("applies presentation attributes via style", async ({ page }) => {
        await page.goto("effects/attr.html")
        const circle = page.locator("#circle")
        const cx = await circle.evaluate((el) =>
            getComputedStyle(el).getPropertyValue("cx")
        )
        expect(cx).toBe("0px")
    })

    test("applies data-* and aria-* attributes", async ({ page }) => {
        await page.goto("effects/attr.html")
        const circle = page.locator("#circle")
        const dataMyValue = await circle.getAttribute("data-my-value")
        expect(dataMyValue).toBe("test")
        const ariaMyValue = await circle.getAttribute("aria-my-value")
        expect(ariaMyValue).toBe("a11y")
    })

    test("applies non-presentational attributes as camelCase", async ({
        page,
    }) => {
        await page.goto("effects/attr.html")
        const turbulence = page.locator("#turbulence feTurbulence")
        const baseFrequency = await turbulence.getAttribute("baseFrequency")
        expect(baseFrequency).toBe("0.1")
        const numOctaves = await turbulence.getAttribute("numOctaves")
        expect(numOctaves).toBe("4")
    })

    test("applies transform-box: fill-box via style if element has transform", async ({
        page,
    }) => {
        await page.goto("effects/transform-box.html")

        const circleViaSVGEffect = page.locator("#via-svg-effect")
        const transformBox = await circleViaSVGEffect.evaluate((el) =>
            getComputedStyle(el).getPropertyValue("transform-box")
        )
        expect(transformBox).toBe("fill-box")

        const circleViaStyleEffect = page.locator("#via-style-effect")
        const transformBox2 = await circleViaStyleEffect.evaluate((el) =>
            getComputedStyle(el).getPropertyValue("transform-box")
        )
        expect(transformBox2).toBe("fill-box")

        const testHtml = page.locator("#test-html")
        const transformBox3 = await testHtml.evaluate((el) =>
            getComputedStyle(el).getPropertyValue("transform-box")
        )
        expect(transformBox3).not.toBe("fill-box")

        const circleViaStyleEffectAndTransformBox = page.locator(
            "#via-style-effect-and-transform-box"
        )
        const transformBox4 =
            await circleViaStyleEffectAndTransformBox.evaluate((el) =>
                getComputedStyle(el).getPropertyValue("transform-box")
            )
        expect(transformBox4).toBe("view-box")
    })
})
