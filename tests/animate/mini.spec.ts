import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
    await page.goto("animate/mini.html")
    // Wait for animations to complete
    await page.waitForTimeout(1000)
})

test.describe("animateMini", () => {
    test("legacy then() fires correctly when animation finishes", async ({
        page,
    }) => {
        const element = page.locator("#then")
        await expect(element).toHaveText("complete")
    })

    test("finished promise correctly fires", async ({ page }) => {
        const element = page.locator("#finished")
        await expect(element).toHaveText("complete")
    })

    test("spring fires correctly after specified duration and applies final styles", async ({
        page,
    }) => {
        const element = page.locator("#spring-duration")
        await expect(element).toHaveText("complete")
    })

    test("spring fires correctly after specified visual duration and applies final styles", async ({
        page,
    }) => {
        const element = page.locator("#spring-visual-duration")
        await expect(element).toHaveText("complete")
    })

    test("duration is returned correctly, as set", async ({ page }) => {
        const element = page.locator("#duration")
        await expect(element).toHaveText("complete")
    })

    test("correctly sets final style", async ({ page }) => {
        const element = page.locator("#final-keyframe")
        await expect(element).toHaveText("complete")
    })

    test("correctly sets final style when reversing", async ({ page }) => {
        const element = page.locator("#final-keyframe-reverse")
        await expect(element).toHaveText("complete")
    })

    test("setting autoplay to false pauses animation", async ({ page }) => {
        const element = page.locator("#autoplay")
        await expect(element).toHaveText("autoplay")
    })

    test("time can be set to midpoint of animation", async ({ page }) => {
        const element = page.locator("#time")
        await expect(element).toHaveCSS("opacity", "0.5")
    })

    test("custom easing function", async ({ page }) => {
        const element = page.locator("#custom-easing")
        await expect(element).toHaveCSS("opacity", "0.25")
    })
})
