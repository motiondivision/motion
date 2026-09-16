import { expect, Page, test } from "@playwright/test"

type Mode = "default" | "custom" | "share" | "share-custom" | "update"

interface AnimationEvent {
    duration: number
    count: number
}

interface PseudoAnimation {
    pseudoElement: string
    duration: number | string | undefined
    easing: string
}

async function open(page: Page, mode: Mode) {
    await page.goto(`?test=animate-view&mode=${mode}`)
    await expect(page.locator("#ordinary")).toContainText("React 19")
    const supported = await page.evaluate(
        () => typeof document.startViewTransition === "function"
    )
    test.skip(!supported, "No startViewTransition support")
    await expect(page.locator("#supported")).toHaveText("true")
}

async function readEvent(page: Page, type: string): Promise<AnimationEvent> {
    const events = page.locator("#events")
    await expect(events).toHaveAttribute(`data-${type}`, /^\{.*\}$/u)
    return JSON.parse((await events.getAttribute(`data-${type}`))!)
}

/**
 * Snapshot the view transition pseudo-element animations while they run.
 */
function readPseudoAnimations(page: Page): Promise<PseudoAnimation[]> {
    return page.evaluate(() =>
        document
            .getAnimations()
            .filter(
                (animation) =>
                    animation.effect instanceof KeyframeEffect &&
                    animation.effect.pseudoElement &&
                    animation.playState !== "finished"
            )
            .map((animation) => {
                const timing = animation.effect!.getTiming()
                return {
                    pseudoElement: (animation.effect as KeyframeEffect)
                        .pseudoElement!,
                    duration: timing.duration as number | string | undefined,
                    easing: timing.easing ?? "",
                }
            })
    )
}

test.describe("AnimateView", () => {
    test("retimes the browser's default enter and exit animations", async ({
        page,
    }) => {
        await open(page, "default")
        await page.locator("#toggle").click()

        const enter = await readEvent(page, "enter")
        expect(enter.duration).toBeCloseTo(0.4, 2)
        expect(enter.count).toBeGreaterThan(0)

        // The browser-generated layers are kept, but run with Motion's timing.
        const layers = (await readPseudoAnimations(page)).filter((animation) =>
            animation.pseudoElement.includes("(_t_")
        )
        expect(layers.length).toBeGreaterThan(0)
        for (const layer of layers) {
            expect(layer.duration).toBe(400)
            expect(layer.easing).toBe("linear")
        }

        await expect(page.locator("#events")).toHaveAttribute(
            "data-enter-complete",
            "true"
        )
        await expect(page.locator("#view")).toBeVisible()

        await page.locator("#toggle").click()
        const exit = await readEvent(page, "exit")
        expect(exit.duration).toBeCloseTo(0.4, 2)
        await expect(page.locator("#events")).toHaveAttribute(
            "data-exit-complete",
            "true"
        )
        await expect(page.locator("#view")).toHaveCount(0)
    })

    test("replaces the browser's animations with custom keyframes", async ({
        page,
    }) => {
        await open(page, "custom")
        await page.locator("#toggle").click()

        const enter = await readEvent(page, "enter")
        expect(enter.duration).toBeCloseTo(0.4, 2)
        // One custom animation, even though the browser generated several layers.
        expect(enter.count).toBe(1)

        const layers = (await readPseudoAnimations(page)).filter((animation) =>
            animation.pseudoElement.includes("(_t_")
        )
        expect(layers).toHaveLength(1)
        expect(layers[0].pseudoElement).toMatch(/^::view-transition-new\(/u)
        expect(layers[0].duration).toBe(400)

        await expect(page.locator("#events")).toHaveAttribute(
            "data-enter-complete",
            "true"
        )

        await page.locator("#toggle").click()
        const exit = await readEvent(page, "exit")
        expect(exit.count).toBe(1)
        const exitLayers = (await readPseudoAnimations(page)).filter(
            (animation) => animation.pseudoElement.includes("(_t_")
        )
        expect(exitLayers).toHaveLength(1)
        expect(exitLayers[0].pseudoElement).toMatch(/^::view-transition-old\(/u)
        await expect(page.locator("#events")).toHaveAttribute(
            "data-exit-complete",
            "true"
        )
        await expect(page.locator("#view")).toHaveCount(0)
    })

    test("retimes shared element transitions", async ({ page }) => {
        await open(page, "share")
        await page.locator("#toggle").click()

        const share = await readEvent(page, "share")
        expect(share.duration).toBeCloseTo(0.4, 2)
        expect(share.count).toBeGreaterThan(0)

        const layers = (await readPseudoAnimations(page)).filter((animation) =>
            animation.pseudoElement.includes("(shared)")
        )
        expect(layers.length).toBeGreaterThan(0)
        for (const layer of layers) {
            expect(layer.duration).toBe(400)
        }

        await expect(page.locator("#events")).toHaveAttribute(
            "data-share-complete",
            "true"
        )
    })

    test("keeps the shared element morph when custom share values replace the crossfade", async ({
        page,
    }) => {
        await open(page, "share-custom")
        const before = await page.locator("#view").boundingBox()
        await page.locator("#toggle").click()

        const share = await readEvent(page, "share")
        expect(share.duration).toBeCloseTo(0.4, 2)

        const layers = (await readPseudoAnimations(page)).filter((animation) =>
            animation.pseudoElement.includes("(shared)")
        )
        const group = layers.filter((layer) =>
            layer.pseudoElement.startsWith("::view-transition-group(")
        )
        const crossfade = layers.filter(
            (layer) => !layer.pseudoElement.startsWith("::view-transition-group(")
        )

        // The browser's group (position/size) morph is kept with Motion timing.
        expect(group).toHaveLength(1)
        expect(group[0].duration).toBe(400)
        expect(group[0].easing).toBe("linear")

        // The browser's old/new crossfade is replaced by the single custom animation.
        expect(crossfade).toHaveLength(1)
        expect(crossfade[0].pseudoElement).toBe("::view-transition-old(shared)")
        expect(crossfade[0].duration).toBe(400)

        await expect(page.locator("#events")).toHaveAttribute(
            "data-share-complete",
            "true"
        )
        const after = await page.locator("#view").boundingBox()
        expect(after!.width).toBeGreaterThan(before!.width)
    })

    test("retimes update transitions", async ({ page }) => {
        await open(page, "update")
        await page.locator("#toggle").click()

        const update = await readEvent(page, "update")
        expect(update.duration).toBeCloseTo(0.4, 2)
        expect(update.count).toBeGreaterThan(0)

        await expect(page.locator("#events")).toHaveAttribute(
            "data-update-complete",
            "true"
        )
    })
})
