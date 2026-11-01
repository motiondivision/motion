import { expect, Page, test } from "@playwright/test"
import { dragFromTo, frames } from "./drag-helpers"

const style = (page: Page, property: string) =>
    page
        .locator("#box")
        .evaluate(
            (el, property) => getComputedStyle(el).getPropertyValue(property),
            property
        )

test.describe("drag: inline styles", () => {
    test("keeps inline styles changed during and before a drag", async ({
        page,
    }) => {
        await page.goto("gestures/drag-inline-styles.html")
        await frames(page, 2)

        await page.locator("#box").evaluate((el) => {
            el.style.borderRadius = "30px"
        })

        await dragFromTo(page, { x: 50, y: 50 }, { x: 150, y: 100 })

        expect(await style(page, "box-shadow")).toBe(
            "rgb(0, 0, 0) 0px 10px 20px 0px"
        )
        expect(await style(page, "border-top-left-radius")).toBe("30px")
    })
})
