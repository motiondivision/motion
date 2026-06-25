import { expect, test } from "@playwright/test"

interface ViewResult {
    ready: boolean
    supported: boolean
    pseudos: string[]
    delays: number[]
    css: string
    survivorCropped: boolean
    supportsGroup: boolean
    parentGroup: string
    childGroup: string
    childrenClipped: boolean
    exitOpacity: string[]
    nameA: string
    nameB: string
    enterFilter: boolean
    cls: string
    groupZ: string
    newTransform: string[]
    oldTransform: string[]
    xOnNew: boolean
    opacityOnNew: boolean
    newOpacity: number[]
    oldOpacity: number[]
    hasGroup: boolean
    scaleOnNew: boolean
    scaleOnOld: boolean
    blendKept: boolean
    vtAnims: string[]
    newScale: Array<string | number>
    toNames: string[]
    newcomerName: string
    newcomerCropped: boolean
    cards: Array<{
        id: string
        old: { delay: number; easing: string } | null
        new: { delay: number; easing: string } | null
    }>
    rootOld: number | null
    rootNew: number | null
    boxGroup: number | null
    boxOld: number | null
    boxOldEasing: string | null
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

    test("morphs that change aspect ratio are clipped + object-fit cover", async ({
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
    })

    test(".crop(false) opts out of the default crop", async ({ page }) => {
        await page.goto("view/view-crop-disabled.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        expect(result.css).not.toMatch(/object-fit/)
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

    test("x/y shorthands are skipped with a warning (use transform)", async ({
        page,
    }) => {
        const warnings: string[] = []
        page.on("console", (m) => {
            if (m.type() === "warning") warnings.push(m.text())
        })

        await page.goto("view/view-x-warn.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        // `x` produced no keyframe (skipped); the `opacity` alongside it works.
        expect(result.xOnNew).toBe(false)
        expect(result.opacityOnNew).toBe(true)
        // ...and a one-time dev warning points at transform.
        expect(warnings.some((w) => /shorthand has no effect/.test(w))).toBe(
            true
        )
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
        // The UA plus-lighter blend must survive our explicit crossfade - if we
        // cancelled it along with the fade, overlapping pixels would darken
        // mid-transition. (vtAnims is captured for diagnosis if this fails.)
        expect(result.blendKept).toBe(true)
    })

    test(".new({scale}) on a survivor animates from the live value, not a 0.85 pop", async ({
        page,
    }) => {
        await page.goto("view/view-survivor-scale.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        const scales = result.newScale.map((v) => parseFloat(String(v)))
        // The scale animation exists and reaches its target...
        expect(scales).toContain(1.1)
        // ...but never starts from the enter default 0.85, which would pop a
        // persisting element that never appeared.
        expect(scales).not.toContain(0.85)
    })

    test("a pair whose new end matches more elements names the extras (no drop)", async ({
        page,
    }) => {
        await page.goto("view/view-pair-mismatch.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        // Both `.to` elements carry a generated name (the extra a fresh one), so
        // neither is silently left unnamed - and the two names are distinct.
        // (Pre-fix the unmatched second element is skipped, so its computed
        // view-transition-name is "none" rather than a motion-view-* name.)
        expect(result.toNames).toHaveLength(2)
        expect(
            result.toNames.every((n) => /^motion-view-\d+$/.test(n))
        ).toBe(true)
        expect(new Set(result.toNames).size).toBe(2)
    })

    test("doesn't crop a same-aspect survivor or a fade-only newcomer by default", async ({
        page,
    }) => {
        await page.goto("view/view-crop-newcomer.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        expect(result.newcomerName).toMatch(/^motion-view-\d+$/)
        // The survivor keeps the same size (same aspect ratio), so cover would
        // do nothing - it's left uncropped (no squaring flash, shadow kept).
        expect(result.survivorCropped).toBe(false)
        // The newcomer is a fade-only enter - no second box - so also uncropped.
        expect(result.newcomerCropped).toBe(false)
    })

    test(".crop(true) clips a new-only layer via the re-committed CSS", async ({
        page,
    }) => {
        await page.goto("view/view-crop-newcomer.html?force")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        expect(result.newcomerName).toMatch(/^motion-view-\d+$/)
        // Forced on, the newcomer's name only exists after the update, so its
        // clip relies on the crop CSS being re-committed in the callback.
        expect(result.newcomerCropped).toBe(true)
    })

    // Browser-agnostic: motion emits the children-clip rule as raw CSS text, so
    // this holds even where the browser ignores it on parse (no nested-group
    // support). Verifies the overflow-mirror + CSS emission.
    test("emits a children-clip rule for a clipping nested parent", async ({
        page,
    }) => {
        await page.goto("view/view-group-nesting.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        expect(result.childrenClipped).toBe(true)
    })

    // The inline `view-transition-group` only survives where the browser knows
    // the property (nested groups, Chromium 140+); elsewhere setProperty drops it
    // and the feature is a graceful no-op. Skipped until the harness Chromium
    // supports it.
    test("nests layers under their DOM ancestor by default (contain)", async ({
        page,
    }) => {
        await page.goto("view/view-group-nesting.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")
        test.skip(!result.supportsGroup, "No nested view-transition groups")

        expect(result.error).toBeNull()
        expect(result.parentGroup).toBe("contain")
        expect(result.childGroup).toBe("contain")
    })

    test(".group(false) opts a layer out of nesting (stays flat)", async ({
        page,
    }) => {
        await page.goto("view/view-group-nesting.html?escape")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")
        test.skip(!result.supportsGroup, "No nested view-transition groups")

        expect(result.error).toBeNull()
        // The opted-out child stays flat; the parent still nests.
        expect(result.childGroup).toBe("none")
        expect(result.parentGroup).toBe("contain")
    })

    test("a survivor's old/new crossfade stays synced and linear (no plus-lighter flash)", async ({
        page,
    }) => {
        await page.goto("view/view-morph-sync.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        expect(result.cards).toHaveLength(3)
        for (const card of result.cards) {
            expect(card.old).not.toBeNull()
            expect(card.new).not.toBeNull()
            // The two halves of the crossfade must start together - a stagger
            // (or enter/exit timing) leaking onto one side desyncs them and the
            // additive blend flashes bright. (Pre-fix: e.g. old 200ms vs new 0.)
            expect(card.old!.delay).toBe(card.new!.delay)
            // ...and fade linearly, not on the bouncy spring (whose opacity
            // overshoots 1 - the spring belongs on the group geometry).
            expect(card.old!.easing).toBe("linear")
            expect(card.new!.easing).toBe("linear")
        }
    })

    test("an explicit .layout({duration}) overrides the inherited spring; a morph keeps its settle", async ({
        page,
    }) => {
        await page.goto("view/view-layout-duration.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        // The root crossfade (dim) honours the explicit 300ms - it is NOT stuck
        // at the spring's settle. (Pre-fix it was ~900ms, the spring overshoot.)
        expect(result.rootOld).toBe(300)
        expect(result.rootNew).toBe(300)
        // The morph, with no override, still runs for the spring's full settle
        // (overshoot) duration - much longer than 300ms.
        expect(result.boxGroup).toBeGreaterThan(700)
    })

    test("a morph crossfade fades over the spring's visual duration, geometry over its settle", async ({
        page,
    }) => {
        await page.goto("view/view-morph-visual-duration.html")
        const result = await readResult(page)
        test.skip(!result.supported, "No startViewTransition support")

        expect(result.error).toBeNull()
        // The opacity crossfade resolves at the perceptual (visual) duration...
        expect(result.boxOld).toBe(550)
        expect(result.boxOldEasing).toBe("linear")
        // ...while the geometry bounces on for the spring's full settle, so the
        // fade doesn't drag through the overshoot. (Pre-fix the fade was ~900ms.)
        expect(result.boxGroup).toBeGreaterThan(700)
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
        // No opacity fade -> both layers stay opaque and overlap mid-slide, so
        // the additive plus-lighter blend must be dropped (else a bright streak).
        expect(result.blendKept).toBe(false)
    })
})
