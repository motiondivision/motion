import { expect, test } from "@playwright/test"

const layoutAnimationTests = [
    "layout-animation-app-store-a-b-a.html",
    "layout-animation-basic-position-change.html",
    "layout-animation-interrupt-animation.html",
    "layout-animation-modal-open-after-animate.html",
    "layout-animation-modal-open-close-interrupt.html",
    "layout-animation-modal-open-close-open-interrupt.html",
    "layout-animation-modal-open-close-open.html",
    "layout-animation-modal-open-close.html",
    "layout-animation-modal-open-opacity.html",
    "layout-animation-modal-open.html",
    "layout-animation-repeat-animation.html",
    "layout-animation-scale-correction.html",
    "layout-animation-scope-with-data-layout.html",
    "layout-animation-shared-element-a-ab-a.html",
    "layout-animation-shared-element-a-b-a-replace.html",
    "layout-animation-shared-element-a-b-a-reuse.html",
    "layout-animation-shared-element-basic.html",
    "layout-animation-shared-element-configured.html",
    "layout-animation-shared-element-crossfade.html",
    "layout-animation-shared-element-nested-children-bottom.html",
    "layout-animation-shared-element-nested-children.html",
    "layout-animation-shared-element-no-crossfade.html",
    "layout-animation-shared-multiple-elements.html",
]

test.describe("animateLayout()", () => {
    test("shared element animation works when animate() is called before animateLayout()", async ({
        page,
    }) => {
        await page.goto("animate-layout/modal-open-after-animate.html")

        // Wait for the test script to run
        await page.waitForTimeout(500)

        // Check that no elements have data-layout-correct="false" (which would indicate test failure)
        const failedElements = await page
            .locator('[data-layout-correct="false"]')
            .count()
        expect(failedElements).toBe(0)
    })

    test("original modal-open test still works", async ({ page }) => {
        await page.goto("animate-layout/modal-open.html")

        // Wait for the test script to run
        await page.waitForTimeout(500)

        // Check that no elements have data-layout-correct="false"
        const failedElements = await page
            .locator('[data-layout-correct="false"]')
            .count()
        expect(failedElements).toBe(0)
    })
})

test.describe("layoutAnimation()", () => {
    layoutAnimationTests.forEach((testName) => {
        test(testName, async ({ page }) => {
            await page.goto(`animate-layout/${testName}`)

            // Wait for the test script to run
            await page.waitForTimeout(500)

            // Check that no elements have data-layout-correct="false" (which would indicate test failure)
            const failedElements = await page
                .locator('[data-layout-correct="false"]')
                .count()
            expect(failedElements).toBe(0)
        })
    })
})
