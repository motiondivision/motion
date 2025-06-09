import { expect, test } from "@playwright/test"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
    })
}

test.beforeEach(async ({ page }) => {
    await page.goto("gestures/resize.html")
})

test.describe("resize", () => {
    test("Resizes #box and checks for success", async ({ page }) => {
        const box = page.locator("#box")
        await expect(box).toHaveText("success")
    })

    test("Resizes svg and checks for success", async ({ page }) => {
        const svgStatus = page.locator("#svg-status")
        await expect(svgStatus).toHaveText("success")
    })

    test("Resizes rect and checks for success", async ({ page }) => {
        const rectStatus = page.locator("#rect-status")
        await expect(rectStatus).toHaveText("success")
    })
})
