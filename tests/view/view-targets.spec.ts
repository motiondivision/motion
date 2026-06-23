import { expect, test } from "@playwright/test"

interface ViewResult {
    ready: boolean
    supported: boolean
    pseudos: string[]
    delays: number[]
    css: string
    radiusAnimated: boolean
    corners: Record<string, string[]>
    exitOpacity: string[]
    nameA: string
    nameB: string
    enterFilter: boolean
    newOpacity: number[]
    oldOpacity: number[]
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

    test("an already-named element keeps its author name (not auto-renamed)", async ({
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
        // ...and .add() reused it rather than generating a name.
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

    test("morphs are clipped, object-fit and radius-animated by default", async ({
        page,
    }) => {
        await page.goto("view/view-crop.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        expect(result.css).toMatch(
            /::view-transition-group\(box\)\s*\{[^}]*overflow:\s*clip/
        )
        expect(result.css).toMatch(
            /::view-transition-old\(box\)[^{]*\{[^}]*object-fit:\s*cover/
        )
        // border-radius (8px -> 28px) animates on the group's clip.
        expect(result.radiusAnimated).toBe(true)
    })

    test("animates individual corner radii", async ({ page }) => {
        await page.goto("view/view-crop-corners.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        // Old: 24px 24px 0 0 (top rounded, bottom square). New: 4px all round.
        // Each corner animates independently from its own start value.
        expect(result.corners.borderTopLeftRadius).toEqual(["24px", "4px"])
        expect(result.corners.borderTopRightRadius).toEqual(["24px", "4px"])
        expect(result.corners.borderBottomRightRadius).toEqual(["0px", "4px"])
        expect(result.corners.borderBottomLeftRadius).toEqual(["0px", "4px"])
    })

    test(".crop(false) opts out of the default crop", async ({ page }) => {
        await page.goto("view/view-crop-disabled.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        expect(result.css).not.toMatch(/object-fit/)
        expect(result.radiusAnimated).toBe(false)
    })

    test(".exit({ opacity: 0 }) animates from an inferred 1, not instantly", async ({
        page,
    }) => {
        await page.goto("view/view-exit-opacity.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        // Two keyframes (not skipped), inferred from 1 down to 0.
        expect(result.exitOpacity.length).toBe(2)
        expect(parseFloat(result.exitOpacity[0])).toBe(1)
        expect(parseFloat(result.exitOpacity[result.exitOpacity.length - 1])).toBe(0)
    })

    test("a stagger in the default options staggers a browser-generated morph", async ({
        page,
    }) => {
        await page.goto("view/view-stagger-default.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        // A function delay must be resolved before timing the morph - feeding
        // it to secondsToMilliseconds would NaN and throw (setting `error`).
        expect(result.error).toBeNull()
        expect(result.delays).toEqual([0, 150, 300])
    })

    test("stagger indexes from the new snapshot when update replaces the nodes", async ({
        page,
    }) => {
        await page.goto("view/view-stagger-replace.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        // The 3 entering tiles stagger 0/150/300 - not pushed past the names of
        // the (replaced) old tiles, which would give 450/600/750.
        expect(result.delays).toEqual([0, 150, 300])
    })

    test("overlapping .add() subjects on one element keep both animations", async ({
        page,
    }) => {
        await page.goto("view/view-overlap.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        // Both buckets survive the collision on one element: `.a`'s enter
        // (filter on the new layer) AND `.b`'s exit (opacity on the old).
        expect(result.enterFilter).toBe(true)
        expect(result.exitOpacity.length).toBeGreaterThan(0)
    })

    test("pairs two elements into one shared-name morph (open direction)", async ({
        page,
    }) => {
        await page.goto("view/view-pair.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        // Both ends were forced onto one generated name...
        expect(result.nameA).toMatch(/^motion-view-\d+$/)
        expect(result.nameB).toBe(result.nameA)
        // ...so #a (old) and #b (new) morph as a single layer.
        expect(result.pseudos).toContain(
            `::view-transition-old(${result.nameA})`
        )
        expect(result.pseudos).toContain(
            `::view-transition-new(${result.nameA})`
        )
    })

    test("pairs morph even when the old element is removed (close direction)", async ({
        page,
    }) => {
        await page.goto("view/view-pair-close.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        // #a is gone, but it was named in the old snapshot before removal, so
        // the shared name still bridges a (old) -> b (new).
        expect(result.nameB).toMatch(/^motion-view-\d+$/)
        expect(result.pseudos).toContain(
            `::view-transition-old(${result.nameB})`
        )
        expect(result.pseudos).toContain(
            `::view-transition-new(${result.nameB})`
        )
    })

    test(".crossfade() animates old out and new in", async ({ page }) => {
        await page.goto("view/view-crossfade.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        // New fades up 0 -> 1, old fades down 1 -> 0 (under the browser's
        // static plus-lighter blend). WAAPI reports keyframe values as strings.
        const num = (v: unknown) => parseFloat(String(v))
        expect(num(result.newOpacity[0])).toBe(0)
        expect(num(result.newOpacity[result.newOpacity.length - 1])).toBe(1)
        expect(num(result.oldOpacity[0])).toBe(1)
        expect(num(result.oldOpacity[result.oldOpacity.length - 1])).toBe(0)
    })
})
