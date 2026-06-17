import { expect, test } from "@playwright/test"

interface ViewResult {
    ready: boolean
    supported: boolean
    pseudos: string[]
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
})
