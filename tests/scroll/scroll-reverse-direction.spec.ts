import { expect, Page, test } from "@playwright/test"

async function settle(page: Page) {
    await page.evaluate(
        () =>
            new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve))
            )
    )
}

/**
 * Scrolls every container to the far end of each axis, whichever sign the
 * browser uses for it, and checks scroll info reports forward scroll.
 */
async function expectForwardScroll(page: Page) {
    const count = await page.evaluate(() => (window as any).containers.length)

    for (let i = 0; i < count; i++) {
        for (const axis of ["x", "y"] as const) {
            const position = axis === "x" ? "scrollLeft" : "scrollTop"
            const label = await page.evaluate(
                (i) =>
                    (window as any).containers[i].getAttribute("style") ?? "",
                i
            )

            await page.evaluate(
                ([i, position]) => {
                    const container = (window as any).containers[i]
                    container[position] = 0
                },
                [i, position] as const
            )
            await settle(page)

            let result = await page.evaluate(
                ([i, axis]) => (window as any).results[i][axis],
                [i, axis] as const
            )
            expect(result.current, `${label} ${axis} start`).toBe(0)
            expect(result.progress, `${label} ${axis} start`).toBe(0)

            const end = await page.evaluate(
                ([i, position]) => {
                    const container = (window as any).containers[i]
                    container[position] = 1e6
                    if (!container[position]) container[position] = -1e6
                    return container[position]
                },
                [i, position] as const
            )
            await settle(page)

            result = await page.evaluate(
                ([i, axis]) => (window as any).results[i][axis],
                [i, axis] as const
            )
            expect(result.scrollLength).toBeGreaterThan(0)
            expect(Math.abs(end), `${label} ${axis}`).toBe(result.scrollLength)
            expect(result.current, `${label} ${axis} end`).toBe(
                result.scrollLength
            )
            expect(result.progress, `${label} ${axis} end`).toBe(1)
        }
    }
}

test.describe("scroll() in reverse-direction containers", () => {
    test.use({ viewport: { width: 500, height: 500 } })

    test("element containers report forward scroll from 0 to scrollLength", async ({
        page,
    }) => {
        await page.goto("scroll/scroll-reverse-direction.html")
        await settle(page)
        await expectForwardScroll(page)
    })

    for (const root of [
        "",
        "direction: rtl",
        "writing-mode: vertical-rl",
        // The viewport doesn't scroll from the end of a flex root
        "display: flex; flex-direction: column-reverse",
    ]) {
        test(`page reports forward scroll with root style "${root}"`, async ({
            page,
        }) => {
            await page.goto(
                `scroll/scroll-reverse-direction.html?root=${encodeURIComponent(
                    root
                )}`
            )
            await settle(page)
            await expectForwardScroll(page)
        })
    }
})
