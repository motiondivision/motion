import { expect, Page, test } from "@playwright/test"

async function load(page: Page) {
    await page.goto("animate/timeline.html")
    await page.waitForFunction(() => Boolean((window as any).Motion))
}

const opacity = (page: Page, id: string) =>
    page.evaluate(
        (id) => Number(getComputedStyle(document.getElementById(id)!).opacity),
        id
    )

const translateX = (page: Page, id: string) =>
    page.evaluate(
        (id) =>
            new DOMMatrix(
                getComputedStyle(document.getElementById(id)!).transform
            ).m41,
        id
    )

test.describe("timeline()", () => {
    test("accelerates opacity", async ({ page }) => {
        await load(page)
        const count = await page.evaluate(async () => {
            const { timeline } = (window as any).Motion
            timeline([["#a", { opacity: 0 }, { duration: 1 }]])
            await new Promise((resolve) => setTimeout(resolve, 100))
            return document.getElementById("a")!.getAnimations().length
        })
        expect(count).toBe(1)
    })

    test("rebuilds from the starting values after finishing", async ({
        page,
    }) => {
        await load(page)
        await page.evaluate(async () => {
            const { timeline } = (window as any).Motion
            const tl = timeline(
                [
                    ["#a", { opacity: 0 }, { duration: 0.1 }],
                    ["#b", { x: 100 }, { duration: 0.1, at: 0 }],
                ],
                { defaultTransition: { ease: "linear" } }
            )
            await tl.finished
            tl.add(["#a", { opacity: 0.5 }, { duration: 0.1 }])
            tl.pause()
            tl.time = 0.05
            ;(window as any).tl = tl
        })
        await page.waitForTimeout(100)

        expect(await opacity(page, "a")).toBeCloseTo(0.5, 1)
        expect(await translateX(page, "b")).toBeCloseTo(50, 0)
    })

    test("keeps the playhead when changed while playing", async ({ page }) => {
        await load(page)
        const [before, after] = await page.evaluate(async () => {
            const { timeline } = (window as any).Motion
            const box = document.getElementById("a")!
            const read = () =>
                new DOMMatrix(getComputedStyle(box).transform).m41
            const tl = timeline([["#a", { x: 100 }, { duration: 2 }]], {
                defaultTransition: { ease: "linear" },
            })
            await new Promise((resolve) => setTimeout(resolve, 500))
            const before = read()
            tl.add(["#a", { x: 0 }, { duration: 2 }])
            // Force the rebuild now, and read before the next frame
            tl.duration
            await Promise.resolve()
            return [before, read()]
        })

        expect(before).toBeGreaterThan(10)
        expect(Math.abs(after - before)).toBeLessThan(5)
    })

    test("pauses at addPause() and resumes", async ({ page }) => {
        await load(page)
        const time = await page.evaluate(async () => {
            const { timeline } = (window as any).Motion
            const tl = timeline([["#a", { opacity: 0 }, { duration: 0.4 }]], {
                defaultTransition: { ease: "linear" },
            })
            tl.addPause(0.1)
            await new Promise((resolve) => setTimeout(resolve, 300))
            ;(window as any).tl = tl
            return tl.time
        })
        expect(time).toBeCloseTo(0.1, 2)
        expect(await opacity(page, "a")).toBeCloseTo(0.75, 1)

        await page.evaluate(() => (window as any).tl.play())
        await page.waitForTimeout(500)
        expect(await opacity(page, "a")).toBe(0)
    })

    test("can be changed while attached to scroll", async ({ page }) => {
        await load(page)
        const errors: string[] = []
        page.on("pageerror", (error) => errors.push(error.message))
        const opacities = await page.evaluate(async () => {
            const { timeline, scroll } = (window as any).Motion
            document.body.style.height = "3000px"
            const wait = () =>
                new Promise((resolve) => setTimeout(resolve, 200))
            const opacity = (id: string) =>
                Number(getComputedStyle(document.getElementById(id)!).opacity)

            const tl = timeline([
                ["#a", { opacity: [1, 0] }, { duration: 1, ease: "linear" }],
            ])
            scroll(tl)
            const max = document.documentElement.scrollHeight - innerHeight
            window.scrollTo(0, max * 0.25)
            await wait()

            tl.add(["#b", { opacity: [1, 0] }, { duration: 1, ease: "linear" }])
            await wait()
            const afterAdd = [opacity("a"), opacity("b")]

            window.scrollTo(0, max * 0.75)
            await wait()
            return [afterAdd, [opacity("a"), opacity("b")]]
        })

        expect(errors).toEqual([])
        // Now 2s long, so 25% scroll is 0.5s: halfway through #a
        expect(opacities[0][0]).toBeCloseTo(0.5, 1)
        expect(opacities[0][1]).toBeCloseTo(1, 1)
        expect(opacities[1][0]).toBeCloseTo(0, 1)
        expect(opacities[1][1]).toBeCloseTo(0.5, 1)
    })
})
