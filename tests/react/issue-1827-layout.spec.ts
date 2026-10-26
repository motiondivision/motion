/**
 * Ref dragConstraints whose element moves or scales in a re-render, with
 * `layout` on it or on the draggable. After the layout animation, dragging
 * far in each direction should stop the box at the container's edges.
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
    const x = b.left + 10
    const y = b.top + 10
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + Math.sign(dx) * 20, y + Math.sign(dy) * 20, {
        steps: 2,
    })
    await page.mouse.move(x + dx, y + dy, { steps: 10 })
    await page.waitForTimeout(50)
    await page.mouse.up()
    await page.waitForTimeout(200)
}

for (const mode of ["move", "movestyle", "boxlayout", "scalelayout", "scalesibling"]) {
    test(`#1827 layout: ${mode}`, async ({ page }) => {
        await page.goto(`?test=issue-1827-layout&mode=${mode}`)
        await page.waitForTimeout(300)
        await page.click("#toggle")
        await page.waitForTimeout(800)

        const gaps: number[] = []
        for (const [dx, dy, edge] of [
            [900, 0, "right"],
            [0, 900, "bottom"],
            [-900, 0, "left"],
            [0, -900, "top"],
        ] as const) {
            await dragBy(page, dx, dy)
            const b = await rect(page, "box")
            const c = await rect(page, "constraints")
            const sign = edge === "right" || edge === "bottom" ? 1 : -1
            gaps.push(Math.round(sign * (c[edge] - b[edge])))
        }

        expect(
            gaps.every((gap) => Math.abs(gap) < 2),
            `gaps ${gaps}`
        ).toBe(true)
    })
}
