import { expect, Page, test } from "@playwright/test"
import { events, frames, rect } from "./drag-helpers"

/**
 * Vanilla equivalent of packages/framer-motion/cypress/integration/drag-momentum.ts.
 *
 * Release velocity only looks at the last 100ms of pointer history and
 * PanSession applies each pointermove on the next frame, so the throw is
 * dispatched in the page: final pointermove, one frame, then pointerup.
 */

function pointer(page: Page, selector: string, type: string, dy: number) {
    return page.evaluate(
        ([selector, type, dy]) => {
            const el = document.querySelector(selector as string)!
            const { left, top, width, height } = el.getBoundingClientRect()
            const w = window as any
            /**
             * Gestures are tracked from the press point, which is stored
             * so later events stay relative to it even as the box moves.
             */
            if (type === "pointerdown") {
                w.pressPoint = { x: left + width / 2, y: top + height / 2 }
            }
            el.dispatchEvent(
                new PointerEvent(type as string, {
                    clientX: w.pressPoint.x,
                    clientY: w.pressPoint.y + (dy as number),
                    pointerId: 1,
                    pointerType: "mouse",
                    isPrimary: true,
                    button: 0,
                    bubbles: true,
                    cancelable: true,
                })
            )
        },
        [selector, type, dy] as const
    )
}

async function flick(page: Page, selector: string, dy: number) {
    await pointer(page, selector, "pointerdown", 0)
    await pointer(page, selector, "pointermove", Math.sign(dy) * 5)
    await frames(page, 1)
    await page.waitForTimeout(50)
    await page.evaluate(
        ([selector, dy]) =>
            new Promise<void>((resolve) => {
                const el = document.querySelector(selector as string)!
                const w = window as any
                const send = (type: string) =>
                    el.dispatchEvent(
                        new PointerEvent(type, {
                            clientX: w.pressPoint.x,
                            clientY: w.pressPoint.y + (dy as number),
                            pointerId: 1,
                            pointerType: "mouse",
                            isPrimary: true,
                            button: 0,
                            bubbles: true,
                        })
                    )
                send("pointermove")
                requestAnimationFrame(() => {
                    send("pointerup")
                    resolve()
                })
            }),
        [selector, dy] as const
    )
}

test.beforeEach(async ({ page }) => {
    await page.goto("gestures/drag-momentum.html")
    await frames(page, 2)
})

test.describe("drag: momentum", () => {
    test("continues moving after release, then settles", async ({ page }) => {
        // A fast throw decays over several seconds with the default
        // timeConstant of 750ms
        test.setTimeout(30000)
        const start = (await rect(page, "#free")).top
        await flick(page, "#free", -200)
        const released = (await rect(page, "#free")).top
        expect(released).toBeLessThan(start - 150)

        await page.waitForTimeout(500)
        const carried = (await rect(page, "#free")).top
        expect(released - carried).toBeGreaterThan(100)

        await expect
            .poll(() => events(page), { timeout: 15000 })
            .toContain("free-settled")
        const settled = (await rect(page, "#free")).top
        await page.waitForTimeout(200)
        expect((await rect(page, "#free")).top).toBe(settled)
        expect(await events(page)).toEqual(["free-end", "free-settled"])
    })

    test("catch-and-release stops momentum", async ({ page }) => {
        await flick(page, "#free", -300)
        const released = (await rect(page, "#free")).top

        // Wait until momentum is visibly carrying the element
        await expect
            .poll(async () => released - (await rect(page, "#free")).top)
            .toBeGreaterThan(20)

        // Catch. Pointerdown stops the animation, which renders its final
        // value on the next frame.
        await pointer(page, "#free", "pointerdown", 0)
        await frames(page, 1)
        const caught = (await rect(page, "#free")).top
        await page.waitForTimeout(50)
        await pointer(page, "#free", "pointerup", 0)

        await page.waitForTimeout(500)
        expect(Math.abs((await rect(page, "#free")).top - caught)).toBeLessThan(
            50
        )
    })

    test("momentum settles at an element constraint", async ({ page }) => {
        const container = await rect(page, "#container")
        await flick(page, "#constrained", 150)

        await expect
            .poll(() => events(page), { timeout: 5000 })
            .toContain("constrained-settled")

        const box = await rect(page, "#constrained")
        expect(box.bottom).toBeCloseTo(container.bottom, 0)
        expect(box.left).toBe(container.left)
    })
})
