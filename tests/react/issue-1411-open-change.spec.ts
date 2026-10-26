/**
 * https://github.com/motiondivision/motion/issues/1411
 *
 * A gallery's thumbnails have layoutId={id} and a persistent detail card has
 * layoutId={open}. With "one" open, "Next" changes the card's layoutId to
 * "two". The card should switch instantly, staying where it is. Thumbnail one
 * should reappear, animating home from the card's box (not from thumbnail
 * two's), and thumbnail two should disappear, as the card now leads its
 * layoutId. Closing then shrinks the card into thumbnail two.
 *
 * The page records every frame with a rAF loop, so these are the frames the
 * browser painted, not samples taken by the test.
 */
import { expect, Page, test } from "@playwright/test"

interface Box {
    x: number
    y: number
    width: number
    height: number
    opacity: number
    visibility: string
}
type Frame = Record<"one" | "two" | "card", Box>

const near = (a: Box, b: Box, tolerance: number) =>
    Math.abs(a.x - b.x) < tolerance &&
    Math.abs(a.y - b.y) < tolerance &&
    Math.abs(a.width - b.width) < tolerance &&
    Math.abs(a.height - b.height) < tolerance

const isHidden = (box: Box) => box.visibility === "hidden" || box.opacity < 0.01

async function framesSince(page: Page, key: string): Promise<Frame[]> {
    return page.evaluate((key) => {
        const w = window as any
        return w.frames.slice(w[key] - 1)
    }, key)
}

for (const query of ["", "&strict=true"]) {
    test(`changing an open card's layoutId switches it instantly${query}`, async ({
        page,
    }) => {
        await page.goto(`?test=issue-1411-open-change${query}`)
        await expect(page.locator("#one")).toBeVisible()
        await page.waitForTimeout(200)
        await page.click("#one")
        // Let the 2s opening animation finish
        await page.waitForTimeout(2500)
        await page.click("#next")
        // ~25% into the 2s animation home
        await page.waitForTimeout(500)

        const [before, ...after] = await framesSince(page, "changedAt")
        const { card, two } = before
        expect(after.length).toBeGreaterThan(10)

        // The card stays where it is, fully opaque: no re-grow, no crossfade
        expect
            .soft(after.filter((frame) => !near(frame.card, card, 2)))
            .toEqual([])
        expect
            .soft(after.filter((frame) => frame.card.opacity < 0.99))
            .toEqual([])

        // Thumbnail one starts from the card's box, not thumbnail two's
        const first = after.find(
            (frame) => !isHidden(frame.one) && !near(frame.one, card, 1)
        )!
        expect(first).toBeDefined()
        expect.soft(first.one, "starts at the card").toMatchObject({
            x: expect.closeTo(card.x, -2),
            y: expect.closeTo(card.y, -2),
            width: expect.closeTo(card.width, -2),
            height: expect.closeTo(card.height, -2),
        })
        // ...and is on its way home
        const last = after[after.length - 1]
        expect(last.one.width).toBeLessThan(first.one.width - 20)
        expect(last.one.width).toBeGreaterThan(160)
        expect(isHidden(last.one)).toBe(false)

        // Thumbnail two disappears once the card leads its layoutId
        expect
            .soft(after.slice(2).filter((frame) => !isHidden(frame.two)))
            .toEqual([])

        // Closing shrinks the card into thumbnail two
        await page.waitForTimeout(2000)
        await page.click("#close")
        await page.waitForTimeout(1000)
        const closing = await framesSince(page, "closedAt")
        const mid = closing[closing.length - 1].two
        expect(isHidden(mid)).toBe(false)
        expect(mid.width).toBeLessThan(card.width - 40)
        expect(mid.width).toBeGreaterThan(two.width + 40)
    })
}

test("changing the card's layoutId mid-open lets it finish opening", async ({
    page,
}) => {
    await page.goto("?test=issue-1411-open-change")
    await expect(page.locator("#one")).toBeVisible()
    await page.waitForTimeout(200)
    await page.click("#one")
    // ~25% into the 2s opening animation
    await page.waitForTimeout(500)
    await page.click("#next")
    await page.waitForTimeout(500)
    const [before, ...after] = await framesSince(page, "changedAt")

    // The card keeps growing towards its box, rather than freezing
    const last = after[after.length - 1]
    expect(last.card.width).toBeGreaterThan(before.card.width + 40)
    expect(isHidden(last.card)).toBe(false)
    // Thumbnail one heads home from where the card was
    expect(last.one.width).toBeLessThan(before.card.width)
    expect(isHidden(last.one)).toBe(false)
    expect(isHidden(last.two)).toBe(true)

    // ...and the card ends up open in its box
    await page.waitForTimeout(1500)
    const [card, one] = await page.evaluate(() =>
        ["card", "one"].map((id) => {
            const element = document.getElementById(id)!
            const { width, height } = element.getBoundingClientRect()
            return {
                width: width - element.offsetWidth,
                height: height - element.offsetHeight,
            }
        })
    )
    expect(card).toEqual({ width: 0, height: 0 })
    expect(one).toEqual({ width: 0, height: 0 })
})
