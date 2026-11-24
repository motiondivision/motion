import { expect, test } from "@playwright/test"

const read = () =>
    Array.from(
        document.querySelectorAll<HTMLElement>("[data-layout]"),
        ({ style }) => [style.willChange, style.transform]
    )

test.describe("layout animation layers", () => {
    test("every element gets will-change while it moves, and loses it after", async ({
        page,
    }) => {
        await page.goto("layout/will-change.html")
        await page.evaluate(() => {
            ;(window as any).run()
        })
        await page.waitForTimeout(200)

        const during = await page.evaluate(read)
        expect(during).toHaveLength(6)
        for (const [willChange, transform] of during) {
            expect(willChange).toBe("transform")
            expect(transform).not.toContain("translate3d")
        }

        await page.waitForTimeout(600)
        for (const [willChange] of await page.evaluate(read)) {
            expect(willChange).toBe("")
        }
    })

    test("past the layer budget, no element gets will-change", async ({
        page,
    }) => {
        await page.goto("layout/will-change.html?count=201&small")
        await page.evaluate(() => {
            ;(window as any).run()
        })
        await page.waitForTimeout(200)

        const during = await page.evaluate(read)
        expect(during).toHaveLength(402)
        for (const [willChange, transform] of during) {
            expect(willChange).toBe("")
            expect(transform).toContain("translate(")
        }
    })

    test("at the layer budget, every element gets will-change", async ({
        page,
    }) => {
        await page.goto("layout/will-change.html?count=200&small")
        await page.evaluate(() => {
            ;(window as any).run()
        })
        await page.waitForTimeout(200)

        const during = await page.evaluate(read)
        expect(during).toHaveLength(400)
        for (const [willChange] of during) {
            expect(willChange).toBe("transform")
        }
    })

    test("elements far outside the viewport get no will-change", async ({
        page,
    }) => {
        await page.goto("layout/will-change.html?top=5000")
        await page.evaluate(() => {
            ;(window as any).run()
        })
        await page.waitForTimeout(200)
        const offscreen = await page.evaluate(read)
        expect(offscreen).toHaveLength(6)
        for (const [willChange, transform] of offscreen) {
            expect(willChange).toBe("")
            expect(transform).toContain("translate(")
        }

        await page.waitForTimeout(600)
        await page.evaluate(() => {
            window.scrollTo(0, 5000)
            ;(window as any).run()
        })
        await page.waitForTimeout(200)
        for (const [willChange] of await page.evaluate(read)) {
            expect(willChange).toBe("transform")
        }
    })

    test("elements that repaint every frame get no will-change", async ({
        page,
    }) => {
        await page.goto("layout/will-change.html?count=6&repaint")
        await page.waitForTimeout(200)
        await page.evaluate(() => {
            ;(window as any).run()
        })
        await page.waitForTimeout(200)

        const during = await page.evaluate(read)
        expect(during).toHaveLength(12)
        during.forEach(([willChange], i) =>
            expect(willChange).toBe(i % 2 ? "transform" : "")
        )
    })

    test("elements with a corrected border radius get will-change only if they keep their size", async ({
        page,
    }) => {
        await page.goto("layout/will-change.html?radius")
        await page.evaluate(() => {
            ;(window as any).run()
        })
        await page.waitForTimeout(200)
        for (const [willChange] of await page.evaluate(read)) {
            expect(willChange).toBe("transform")
        }

        await page.goto("layout/will-change.html?radius&grow")
        await page.evaluate(() => {
            ;(window as any).run()
        })
        await page.waitForTimeout(200)
        const during = await page.evaluate(read)
        expect(during).toHaveLength(6)
        during.forEach(([willChange, transform], i) => {
            expect(willChange).toBe(i % 2 ? "transform" : "")
            i % 2 || expect(transform).toContain("scale(")
        })
    })

    test("elements animating on the compositor share the layer budget", async ({
        page,
    }) => {
        await page.goto("layout/will-change.html?animated=398")
        await page.waitForTimeout(100)
        expect(await page.evaluate(() => (window as any).accelerated())).toBe(
            398
        )

        await page.evaluate(() => {
            ;(window as any).run()
        })
        await page.waitForTimeout(200)
        for (const [willChange] of await page.evaluate(read)) {
            expect(willChange).toBe("")
        }

        await page.waitForTimeout(600)
        await page.evaluate(() => {
            ;(window as any).stopBoxes()
            ;(window as any).run()
        })
        await page.waitForTimeout(200)
        for (const [willChange] of await page.evaluate(read)) {
            expect(willChange).toBe("transform")
        }
    })
})
