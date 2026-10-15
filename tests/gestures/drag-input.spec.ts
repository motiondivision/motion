import { expect, test } from "@playwright/test"
import { dispatchPointer, dragBy, events, frames, rect } from "./drag-helpers"

/**
 * Vanilla equivalent of
 * packages/framer-motion/cypress/integration/drag-input-propagation.ts.
 *
 * Text inputs, textareas, selects, checkboxes and contenteditable children
 * block drag. Buttons, links and the draggable's own area start it.
 */

test.beforeEach(async ({ page }) => {
    await page.goto("gestures/drag-input.html")
    await frames(page, 2)
    expect(await rect(page, "#draggable")).toMatchObject({
        left: 100,
        top: 100,
    })
})

const start = { x: 5, y: 5 }

for (const id of [
    "input",
    "textarea",
    "select",
    "checkbox",
    "contenteditable",
]) {
    test(`drag: doesn't start on a child ${id}`, async ({ page }) => {
        await dragBy(
            page,
            `#${id}`,
            200,
            200,
            id === "checkbox" ? { x: 2, y: 2 } : start
        )
        expect(await rect(page, "#draggable")).toMatchObject({
            left: 100,
            top: 100,
        })
        expect(await events(page)).toEqual([])
    })
}

for (const id of ["button", "draggable"]) {
    test(`drag: starts on ${
        id === "draggable" ? "the draggable itself" : `a child ${id}`
    }`, async ({ page }) => {
        await dragBy(page, `#${id}`, 200, 200, start)
        expect(await rect(page, "#draggable")).toMatchObject({
            left: 300,
            top: 300,
        })
        expect(await events(page)).toEqual(["start"])
    })
}

/**
 * With a real mouse, pressing a link and moving starts the browser's
 * native link drag, which fires pointercancel. React <motion.div drag>
 * behaves the same in Chromium; Cypress only passes this case because it
 * dispatches synthetic events. So, like Cypress, this checks with
 * synthetic events that a link doesn't block the drag listener.
 */
test("drag: starts on a child link", async ({ page }) => {
    const link = await rect(page, "#link")
    const x = link.left + 5
    const y = link.top + 5
    await dispatchPointer(page, "#link", "pointerdown", x, y)
    await dispatchPointer(page, "#link", "pointermove", x + 5, y + 5)
    await frames(page, 1)
    await dispatchPointer(page, "#link", "pointermove", x + 200, y + 200)
    await frames(page, 1)
    await dispatchPointer(page, "#link", "pointerup", x + 200, y + 200)
    await frames(page, 2)

    expect(await rect(page, "#draggable")).toMatchObject({
        left: 300,
        top: 300,
    })
    expect(await events(page)).toEqual(["start"])
})
