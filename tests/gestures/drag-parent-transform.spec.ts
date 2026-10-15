import { expect, Page, test } from "@playwright/test"
import { dragFromTo, frames, rect } from "./drag-helpers"

/**
 * Vanilla equivalents of drag-scaled-parent.ts and drag-rotated-parent.ts.
 *
 * React passes these with
 * <MotionConfig transformPagePoint={correctParentTransform(ref)}>. Vanilla
 * drag() has no transformPagePoint option, so the element moves by the
 * pointer distance in its parent's transformed space: half as far in a
 * scale(0.5) parent, twice as far in scale(2), and the wrong way when
 * rotated 180deg. These are expected to fail until drag() accepts one.
 */

const open = async (page: Page, query: string) => {
    await page.goto(`gestures/drag-parent-transform.html?${query}`)
    await frames(page, 2)
}

for (const scale of [0.5, 2]) {
    test(`drag: follows the pointer in a scale(${scale}) parent`, async ({
        page,
    }) => {
        test.fail(true, "Needs transformPagePoint, which drag() lacks")
        await open(page, `scale=${scale}`)
        await dragFromTo(page, { x: 10, y: 10 }, { x: 110, y: 110 })
        const { left, top } = await rect(page, "#box")
        expect(left).toBeGreaterThan(80)
        expect(left).toBeLessThan(120)
        expect(top).toBeGreaterThan(80)
        expect(top).toBeLessThan(120)
    })
}

test("drag: follows the pointer in a rotate(180deg) parent", async ({
    page,
}) => {
    test.fail(true, "Needs transformPagePoint, which drag() lacks")
    await open(page, "rotate=180")

    // The child is at the top left of a 400x400 parent rotated around its
    // centre, so it renders at (300, 300)
    const start = await rect(page, "#box")
    expect(start.left).toBeCloseTo(300, 0)

    await dragFromTo(page, { x: 350, y: 350 }, { x: 450, y: 350 })
    expect((await rect(page, "#box")).left).toBeGreaterThan(350)
})
