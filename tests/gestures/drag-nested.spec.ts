import { expect, Page, test } from "@playwright/test"
import { dragBy, events, frames, pressAndMove, rect } from "./drag-helpers"

/**
 * Vanilla equivalent of packages/framer-motion/cypress/integration/drag-nested.ts
 * ("Neither" variants; vanilla drag() has no layout prop).
 *
 * #parent: 300x300 at (100, 100), draggable
 * #child: 600x200 at parent + (50, 50), draggable
 * #control: plain element at child + (50, 50)
 */

const open = async (page: Page, query = "") => {
    await page.goto(`gestures/drag-nested.html${query}`)
    await frames(page, 2)
}

const position = async (page: Page, selector: string) => {
    const { left, top } = await rect(page, selector)
    return { left, top }
}

const expectPositions = async (
    page: Page,
    expected: Record<string, { left: number; top: number }>
) => {
    for (const selector in expected) {
        expect(await position(page, selector), selector).toEqual(
            expected[selector]
        )
    }
}

// Grab the parent where the child doesn't cover it
const parentPoint = { x: 5, y: 5 }
const childPoint = { x: 5, y: 5 }

test.describe("drag: nested", () => {
    test("parent and child drag independently", async ({ page }) => {
        await open(page)
        await expectPositions(page, {
            "#parent": { left: 100, top: 100 },
            "#child": { left: 150, top: 150 },
            "#control": { left: 200, top: 200 },
        })

        await dragBy(page, "#parent", 50, 50, parentPoint)
        await expectPositions(page, {
            "#parent": { left: 150, top: 150 },
            "#child": { left: 200, top: 200 },
            "#control": { left: 250, top: 250 },
        })

        await dragBy(page, "#child", 50, 50, childPoint)
        await expectPositions(page, {
            "#parent": { left: 150, top: 150 },
            "#child": { left: 250, top: 250 },
            "#control": { left: 300, top: 300 },
        })

        await dragBy(page, "#parent", 50, 50, parentPoint)
        await expectPositions(page, {
            "#parent": { left: 200, top: 200 },
            "#child": { left: 300, top: 300 },
            "#control": { left: 350, top: 350 },
        })

        expect(await events(page)).toEqual([
            "parent-start",
            "parent-end",
            "child-start",
            "child-end",
            "parent-start",
            "parent-end",
        ])
    })

    test("parent and child respect their own constraints", async ({ page }) => {
        await open(page, "?constraints=true")

        // Parent top constraint is -10, left is unconstrained
        await dragBy(page, "#parent", -20, -20, { x: 40, y: 40 })
        await expectPositions(page, {
            "#parent": { left: 80, top: 90 },
            "#child": { left: 130, top: 140 },
            "#control": { left: 180, top: 190 },
        })

        // Parent right constraint is 100
        await dragBy(page, "#parent", 200, 100, parentPoint)
        await expectPositions(page, {
            "#parent": { left: 200, top: 190 },
            "#child": { left: 250, top: 240 },
            "#control": { left: 300, top: 290 },
        })

        // Child right constraint is 100, bottom is unconstrained
        await dragBy(page, "#child", 300, 100, childPoint)
        await expectPositions(page, {
            "#parent": { left: 200, top: 190 },
            "#child": { left: 350, top: 340 },
            "#control": { left: 400, top: 390 },
        })
    })

    test("elastic constraints overshoot and return for parent and child", async ({
        page,
    }) => {
        await open(page, "?constraints=true&animation=true")

        const parent = await rect(page, "#parent")
        await pressAndMove(
            page,
            { x: parent.left + 5, y: parent.top + 10 },
            { x: parent.left + 205, y: parent.top + 10 }
        )
        // 200px against a right constraint of 100 with elastic 0.5
        expect((await position(page, "#parent")).left).toBe(250)
        expect((await position(page, "#child")).left).toBe(300)
        await page.mouse.up()

        await expect
            .poll(() => position(page, "#parent"), { timeout: 5000 })
            .toEqual({ left: 200, top: 100 })
        expect(await position(page, "#child")).toEqual({
            left: 250,
            top: 150,
        })

        const child = await rect(page, "#child")
        await pressAndMove(
            page,
            { x: child.left + 5, y: child.top + 10 },
            { x: child.left + 205, y: child.top + 10 }
        )
        expect((await position(page, "#child")).left).toBe(400)
        expect((await position(page, "#parent")).left).toBe(200)
        await page.mouse.up()

        await expect
            .poll(() => position(page, "#child"), { timeout: 5000 })
            .toEqual({ left: 350, top: 150 })
    })

    test("child on x passes the y axis to a parent on y", async ({ page }) => {
        await open(page, "?bothAxes=true")

        const child = await rect(page, "#child")
        await pressAndMove(
            page,
            { x: child.left + 5, y: child.top + 5 },
            { x: child.left + 105, y: child.top + 105 }
        )
        const expected = {
            "#child": { left: 250, top: 250 },
            "#control": { left: 300, top: 300 },
            "#parent": { left: 100, top: 200 },
        }
        await expectPositions(page, expected)

        await page.mouse.up()
        await frames(page, 2)
        await expectPositions(page, expected)
    })

    test("propagation lets the parent drag with the child", async ({
        page,
    }) => {
        await open(page, "?propagation=true")

        await dragBy(page, "#child", 50, 50, childPoint)
        await expectPositions(page, {
            "#parent": { left: 150, top: 150 },
            "#child": { left: 250, top: 250 },
            "#control": { left: 300, top: 300 },
        })
        expect((await events(page)).sort()).toEqual(
            ["child-end", "child-start", "parent-end", "parent-start"].sort()
        )
    })
})
