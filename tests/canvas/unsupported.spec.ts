import { expect, test } from "@playwright/test"

test("without HTML-in-canvas, canvasLayer fails soft", async ({ page }) => {
    // Without the trial shim, this Chromium has neither API shape
    await page.goto("canvas/unsupported.html?noshim")
    await page.waitForFunction(() => (window as any).result)

    expect(await page.evaluate(() => (window as any).result)).toEqual({
        supported: false,
        // The canvas is left as it was, so it can still get a 2D context
        content: null,
        context: true,
        drawable: false,
        // The element is still fallback content, styled as normal
        transform: "translateX(100px)",
        renderVideo: "renderVideo() needs HTML-in-canvas support.",
    })
})
