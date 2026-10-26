/**
 * The #1827 sandbox: cycle the constraints container's scale after mount,
 * then drag far in each direction. The box should stop at the container's
 * visual edges, as it does after a remount.
 *
 * The draggable's own scale isn't accounted for in constraints, so its
 * cycle isn't tested.
 */
import { expect, Page, test } from "@playwright/test"

const rect = (page: Page, id: string) =>
    page.evaluate((id) => {
        const { left, top, right, bottom } = document
            .getElementById(id)!
            .getBoundingClientRect()
        return { left, top, right, bottom }
    }, id)

async function dragBy(page: Page, dx: number, dy: number) {
    const b = await rect(page, "box")
    const x = (b.left + b.right) / 2
    const y = (b.top + b.bottom) / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + Math.sign(dx) * 20, y + Math.sign(dy) * 20, {
        steps: 2,
    })
    await page.mouse.move(x + dx, y + dy, { steps: 10 })
    await page.waitForTimeout(50)
    await page.mouse.up()
    // Default momentum and elastic: wait for the bounce to settle
    await page.waitForTimeout(1500)
}

/**
 * Gaps between the box and the container edge it was dragged towards:
 * 0 is right, negative overflows, positive stops short.
 */
async function edgeGaps(page: Page) {
    const gaps: number[] = []
    for (const [dx, dy, edge] of [
        [500, 0, "right"],
        [-500, 0, "left"],
        [0, 400, "bottom"],
        [0, -400, "top"],
    ] as const) {
        await dragBy(page, dx, dy)
        const b = await rect(page, "box")
        const c = await rect(page, "constraints")
        const sign = edge === "right" || edge === "bottom" ? 1 : -1
        gaps.push(Math.round(sign * (c[edge] - b[edge])))
    }
    return gaps
}

for (const con of [0, 1, 2]) {
    for (const remount of [false, true]) {
        test(`#1827 sandbox: container×${con}${
            remount ? " remount" : ""
        }`, async ({ page }) => {
            await page.goto("?test=issue-1827-sandbox")
            await page.waitForTimeout(200)
            for (let i = 0; i < con; i++) await page.click("#con-size")
            if (remount) await page.click("#refresh")
            await page.waitForTimeout(400)
            const gaps = await edgeGaps(page)
            expect(
                gaps.every((gap) => Math.abs(gap) < 2),
                `gaps ${gaps}`
            ).toBe(true)
        })
    }
}
