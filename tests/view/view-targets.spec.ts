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
    cls: string
    groupZ: string
    newTransform: string[]
    oldTransform: string[]
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

    test("a second .add() of the same element doesn't drop the first's animation", async ({
        page,
    }) => {
        await page.goto("view/view-overlap.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        // `.a`'s enter (filter) must survive the merge when `.b` re-adds the
        // same element - the second subject can't clobber the first's bucket.
        expect(result.enterFilter).toBe(true)
    })

    test("pairs two elements into one shared-name morph (open direction)", async ({
        page,
    }) => {
        await page.goto("view/view-pair.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        // #b (the `to`) carries the shared generated name...
        expect(result.nameB).toMatch(/^motion-view-\d+$/)
        // ...and #a (old) + #b (new) morph as a single layer under it.
        expect(result.pseudos).toContain(
            `::view-transition-old(${result.nameB})`
        )
        expect(result.pseudos).toContain(
            `::view-transition-new(${result.nameB})`
        )
        // #a stays rendered (visibility: hidden), so its name had to be
        // transferred to #b - it must NOT still carry the shared name, or the
        // two collide ("duplicate view-transition-name").
        expect(result.nameA).not.toBe(result.nameB)
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

    test("enter/exit do not apply to a persistent (survivor) element", async ({
        page,
    }) => {
        await page.goto("view/view-survivor.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        // It morphs...
        expect(result.hasGroup).toBe(true)
        // ...but enter/exit (which scale) must NOT leak onto a survivor - it's
        // not appearing or leaving. (Fails pre-fix: scale lands on both.)
        expect(result.scaleOnNew).toBe(false)
        expect(result.scaleOnOld).toBe(false)
    })

    test("`.class()` tags layers with a view-transition-class for CSS targeting", async ({
        page,
    }) => {
        await page.goto("view/view-class.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        // The resolved element carries the class we can key CSS to...
        expect(result.cls).toBe("tag")
        // ...and `::view-transition-group(.tag) { z-index: 99 }` reaches the
        // generated (name-opaque) group layer.
        expect(result.groupZ).toBe("99")
    })

    test(".new()/.old() crossfade a persistent (survivor) element", async ({
        page,
    }) => {
        await page.goto("view/view-crossfade.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        // View-based (ungated): on a survivor, .new() fades up 0 -> 1 and .old()
        // down 1 -> 0 (enter/exit would both be skipped here). Origins inferred.
        const num = (v: unknown) => parseFloat(String(v))
        expect(num(result.newOpacity[0])).toBe(0)
        expect(num(result.newOpacity[result.newOpacity.length - 1])).toBe(1)
        expect(num(result.oldOpacity[0])).toBe(1)
        expect(num(result.oldOpacity[result.oldOpacity.length - 1])).toBe(0)
    })

    test(".new()/.old() slide a survivor's views in opposite directions", async ({
        page,
    }) => {
        await page.goto("view/view-slide.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        // Independent (not mirrored): new slides in from the right, old out to
        // the left - both on the same persistent element.
        expect(result.newTransform[0]).toContain("40px")
        expect(
            result.oldTransform[result.oldTransform.length - 1]
        ).toContain("-40px")
    })
})
