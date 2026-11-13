/**
 * #4053: pressing a Reorder.Item's text and dragging below its
 * overflow-y: auto container made the container scroll, and its scrollable
 * area grow, without bound in WebKit.
 *
 * The press starts the browser's mouse-drag text selection, and with it
 * selection autoscroll. That scrolls the container towards the pointer,
 * PanSession moves the item down by as much to keep it under the pointer,
 * the item's transform grows the container's scrollable overflow, so
 * autoscroll never runs out of room.
 *
 * WebKit lets a selection begin inside user-select: none (only
 * -webkit-user-drag: element with it stops that), so the plain item fails
 * there. Chromium doesn't, but fails the same way when the press is on a
 * selectable drag handle (dragControls), the #1489 case.
 *
 * Run in WebKit with: npx playwright test --project=react-19-webkit
 */
import { expect, Page, test } from "@playwright/test"
import { frames } from "../gestures/drag-helpers"

async function dragBelowContainer(page: Page) {
    const container = page.locator("#scroll-container")
    await expect(page.locator("#item-5")).toBeVisible()
    await frames(page, 2)

    const start = await page.evaluate(() => {
        const c = document.getElementById("scroll-container")!
        const text =
            document.querySelector("#item-5 .handle") ||
            document.getElementById("item-5")!
        const r = text.getBoundingClientRect()
        return {
            x: r.left + 20,
            y: r.top + r.height / 2,
            bottom: c.getBoundingClientRect().bottom,
            scrollHeight: c.scrollHeight,
        }
    })

    // Press Item 5's text and drag past the bottom of the container,
    // towards the Control text, then hold and wiggle there.
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await frames(page, 1)
    await page.mouse.move(start.x, start.y + 10)
    await frames(page, 1)
    const belowY = start.bottom + 40
    await page.mouse.move(start.x, belowY, { steps: 15 })

    let maxScrollHeight = start.scrollHeight
    for (let i = 0; i < 40; i++) {
        await page.waitForTimeout(50)
        await page.mouse.move(start.x + (i % 2 ? 2 : -2), belowY)
        maxScrollHeight = Math.max(
            maxScrollHeight,
            await container.evaluate((c) => c.scrollHeight)
        )
    }

    const result = await page.evaluate(() => {
        const c = document.getElementById("scroll-container")!
        return {
            scrollTop: c.scrollTop,
            selection: String(window.getSelection()),
        }
    })
    await page.mouse.up()

    return { ...result, maxScrollHeight, startScrollHeight: start.scrollHeight }
}

for (const handle of [false, true]) {
    test(`dragging below a scroll container doesn't grow it without bound${
        handle ? " (drag handle)" : ""
    }`, async ({ page }) => {
        await page.goto(
            "?test=reorder-scroll-container-selection" +
                (handle ? "&handle=1" : "")
        )

        const { scrollTop, selection, maxScrollHeight, startScrollHeight } =
            await dragBelowContainer(page)

        /**
         * The dragged item may extend the container's overflow by roughly
         * the distance it's dragged past the bottom (about 200px here), and
         * Motion's own auto-scroll stops at the scroll limit the drag
         * started with. Runaway autoscroll grows it by thousands of pixels.
         */
        expect(maxScrollHeight, "container scrollHeight").toBeLessThan(
            startScrollHeight + 300
        )
        expect(scrollTop, "container scrollTop").toBeLessThan(150)

        // No native text selection started by the drag
        expect(selection, "text selected by the drag").toBe("")
    })
}
