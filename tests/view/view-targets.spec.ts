import { expect, test } from "@playwright/test"

interface ViewResult {
    ready: boolean
    supported: boolean
    pseudos: string[]
    delays: number[]
    error: string | null
}

const readResult = async (page: import("@playwright/test").Page) => {
    await page.waitForFunction(
        () => (window as any).__view && (window as any).__view.ready
    )
    return page.evaluate(() => (window as any).__view as ViewResult)
}

const layerNames = (pseudos: string[]) =>
    new Set(
        pseudos
            .map((p) => p.match(/\((motion-view-\d+)\)/)?.[1])
            .filter(Boolean) as string[]
    )

test.describe("animateView() target resolution", () => {
    test("Element target is auto-named and animates its new layer", async ({
        page,
    }) => {
        await page.goto("view/view-target-element.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        // A generated, script-targetable name animates the `new` layer.
        expect(
            result.pseudos.some((p) =>
                /::view-transition-(new|group)\(motion-view-\d+\)/.test(p)
            )
        ).toBe(true)
    })

    test("selector matching 3 elements produces 3 distinct named layers", async ({
        page,
    }) => {
        await page.goto("view/view-target-selector.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        expect(layerNames(result.pseudos).size).toBeGreaterThanOrEqual(3)
    })

    test("pre-named layer (.addName) still works and is not renamed", async ({
        page,
    }) => {
        await page.goto("view/view-target-prenamed.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        // The author's `box` layer animates...
        expect(
            result.pseudos.some((p) =>
                /::view-transition-(new|group)\(box\)/.test(p)
            )
        ).toBe(true)
        // ...and nothing was auto-resolved into a generated name.
        expect(layerNames(result.pseudos).size).toBe(0)
    })

    test("a bare .add() auto-enables a layout (group) morph", async ({
        page,
    }) => {
        await page.goto("view/view-auto-layout.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        // No bucket was set, yet the resolved element morphs via its group layer.
        expect(
            result.pseudos.some((p) =>
                /::view-transition-group\(motion-view-\d+\)/.test(p)
            )
        ).toBe(true)
    })

    test("stagger delays are applied per resolved element", async ({ page }) => {
        await page.goto("view/view-stagger.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        expect(result.delays.length).toBeGreaterThanOrEqual(3)
        // Each resolved element gets its own staggered delay.
        expect(new Set(result.delays).size).toBe(result.delays.length)
        expect(Math.max(...result.delays)).toBeGreaterThan(0)
    })
})
