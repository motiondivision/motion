import { expect, Page, test } from "@playwright/test"

/**
 * The keyframes of each running WAAPI animation on an element, by property.
 */
const getAnimations = (page: Page, selector: string) =>
    page.locator(selector).evaluate((element) =>
        element.getAnimations().map((animation) => {
            const effect = animation.effect as KeyframeEffect
            const [from, to] = effect.getKeyframes()
            const property = Object.keys(from).find(
                (key) =>
                    ![
                        "offset",
                        "easing",
                        "composite",
                        "computedOffset",
                    ].includes(key)
            )!
            return {
                property,
                from: from[property] as string,
                to: to[property] as string,
                delay: effect.getTiming().delay,
            }
        })
    )

const style = (page: Page, selector: string, property: string) =>
    page
        .locator(selector)
        .evaluate(
            (element, property) => getComputedStyle(element)[property as any],
            property
        )

test.describe("mini motion component", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("?test=mini-motion")
        await page.waitForSelector("#mount")
    })

    test("animates from initial to animate on mount", async ({ page }) => {
        await expect
            .poll(() => getAnimations(page, "#mount"))
            .toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        property: "opacity",
                        from: "0",
                        to: "1",
                    }),
                    expect.objectContaining({
                        property: "translate",
                        from: "-100px",
                        to: "0px",
                    }),
                ])
            )
    })

    test("renders animate values without animating with initial={false}", async ({
        page,
    }) => {
        await page.waitForTimeout(100)
        expect(await getAnimations(page, "#initial-false")).toEqual([])
        expect(await style(page, "#initial-false", "opacity")).toBe("0.5")
        expect(await style(page, "#initial-false", "translate")).toBe("50px")
        expect(await style(page, "#initial-false", "transform")).not.toBe(
            "none"
        )
    })

    test("animates to whileHover and back", async ({ page }) => {
        await page.hover("#hover")
        await expect
            .poll(() => getAnimations(page, "#hover"))
            .toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        property: "scale",
                        to: "1.2",
                    }),
                    expect.objectContaining({
                        property: "backgroundColor",
                        to: "rgb(0, 0, 255)",
                    }),
                ])
            )

        await page.mouse.move(500, 500)
        await expect
            .poll(() => getAnimations(page, "#hover"))
            .toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ property: "scale", to: "1" }),
                    expect.objectContaining({
                        property: "backgroundColor",
                        to: "rgb(255, 0, 0)",
                    }),
                ])
            )
    })

    test("whileTap takes priority over whileHover", async ({ page }) => {
        await page.hover("#hover")
        await page.mouse.down()
        await expect
            .poll(() => getAnimations(page, "#hover"))
            .toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        property: "scale",
                        to: "0.8",
                    }),
                ])
            )
        await page.mouse.up()
        await expect
            .poll(() => getAnimations(page, "#hover"))
            .toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        property: "scale",
                        to: "1.2",
                    }),
                ])
            )
    })

    test("staggers children that inherit variants", async ({ page }) => {
        const delays = await Promise.all(
            [0, 1, 2].map((i) =>
                expect
                    .poll(async () =>
                        (
                            await getAnimations(page, `#item-${i}`)
                        ).map(({ property, delay }) => [property, delay])
                    )
                    .toEqual(expect.arrayContaining([["opacity", i * 100]]))
            )
        )
        expect(delays).toHaveLength(3)
        const [translate] = (await getAnimations(page, "#item-2")).filter(
            ({ property }) => property === "translate"
        )
        expect(translate.from).toBe("-20px")
    })

    test("runs exit animations before AnimatePresence removes the element", async ({
        page,
    }) => {
        await page.click("#toggle")
        await expect
            .poll(() => getAnimations(page, "#exit"))
            .toEqual([
                expect.objectContaining({ property: "opacity", to: "0" }),
            ])
        await expect(page.locator("#exit")).toHaveCount(0)
    })

    test("interrupts from the current value", async ({ page }) => {
        await page.click("#retarget")
        await page.waitForTimeout(1000)
        await page.click("#retarget")
        await expect
            .poll(async () => (await getAnimations(page, "#interrupt"))[0]?.to)
            .toBe("100px")
        const [{ from }] = await getAnimations(page, "#interrupt")
        const x = parseFloat(from)
        expect(x).toBeGreaterThan(80)
        expect(x).toBeLessThan(99)
    })

    test("renders motion values in style", async ({ page }) => {
        expect(await style(page, "#motion-value", "translate")).toBe("0px")
        await page.click("#set-x")
        await expect
            .poll(() => style(page, "#motion-value", "translate"))
            .toBe("42px")
    })
})
