import { expect, test } from "@playwright/test"

test("WAAPI animations start immediately when the document timeline is slowed", async ({
    page,
    browserName,
}) => {
    test.skip(browserName !== "chromium", "Requires the DevTools protocol")

    await page.goto("animate/animate-timeline-playback-rate.html")
    await page.waitForFunction(() => (window as any).run)

    /**
     * Equivalent to setting the DevTools Animations panel to 10%. This
     * slows document.timeline while performance.now() runs at full speed.
     */
    const client = await page.context().newCDPSession(page)
    await client.send("Animation.enable")
    await client.send("Animation.setPlaybackRate", { playbackRate: 0.1 })

    // Let document.timeline fall behind performance.now()
    await page.waitForTimeout(2000)

    await page.evaluate(() => (window as any).run())

    // ~50ms of timeline time at 10% playback
    await page.waitForTimeout(500)

    const { currentTime, opacity } = await page.evaluate(() => {
        const box = document.getElementById("box")!
        const [animation] = box.getAnimations()
        return {
            currentTime: Number(animation?.currentTime),
            opacity: Number(getComputedStyle(box).opacity),
        }
    })

    expect(currentTime).toBeGreaterThan(0)
    expect(opacity).toBeGreaterThan(0)
})
