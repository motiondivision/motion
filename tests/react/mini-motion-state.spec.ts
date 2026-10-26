import { expect, Page, test } from "@playwright/test"

const getAnimations = (page: Page, selector: string) =>
    page.locator(selector).evaluate((element) =>
        element.getAnimations().map((animation) => {
            const effect = animation.effect as KeyframeEffect
            const [from] = effect.getKeyframes()
            return {
                property: Object.keys(from).find(
                    (key) =>
                        ![
                            "offset",
                            "easing",
                            "composite",
                            "computedOffset",
                        ].includes(key)
                )!,
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

test.describe("mini motion component state", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("?test=mini-motion-state")
        await page.waitForSelector("#object-child")
    })

    test("children don't inherit an initial target object", async ({
        page,
    }) => {
        await page.waitForTimeout(300)
        expect(await style(page, "#object-child", "opacity")).toBe("1")
    })

    test("AnimatePresence initial={false} skips the mount animation", async ({
        page,
    }) => {
        await page.waitForTimeout(100)
        expect(await getAnimations(page, "#presence-initial")).toEqual([])
        expect(await style(page, "#presence-initial", "opacity")).toBe("1")
    })

    test("re-entering during exit animates back and can exit again", async ({
        page,
    }) => {
        await page.click("#toggle")
        await page.waitForTimeout(300)
        await page.click("#toggle")
        await expect
            .poll(() => style(page, "#reenter", "opacity"), { timeout: 3000 })
            .toBe("1")

        await page.click("#toggle")
        await expect(page.locator("#reenter")).toHaveCount(0, {
            timeout: 3000,
        })
    })

    test("an exit whose target changes still removes the element", async ({
        page,
    }) => {
        await page.click("#toggle-slide")
        await page.waitForTimeout(300)
        await page.click("#direction")
        await expect(page.locator("#slide")).toHaveCount(0, {
            timeout: 3000,
        })
    })

    test("delayChildren doesn't delay a child's own targets", async ({
        page,
    }) => {
        await page.click("#count")
        await expect
            .poll(() => getAnimations(page, "#own-target-child"))
            .toEqual([{ property: "translate", delay: 0 }])
    })

    test("a motion value keeps the animated values that share its CSS property", async ({
        page,
    }) => {
        await page.click("#set-x")
        await expect
            .poll(() => style(page, "#motion-value-and-animate", "translate"))
            .toBe("42px 50px")
    })
})
