import { expect, test } from "@playwright/test"

/**
 * A mouse press on a Reorder.Item has its default prevented (#4053), so it
 * no longer moves focus, which used to drop a keyboard grab by blurring
 * the grabbed item. In a Reorder.Board, a press on an item in another
 * group must drop it too.
 */
test("pressing an item in another group drops a keyboard grab", async ({
    page,
}) => {
    await page.goto("?test=reorder-board")
    const state = page.getByTestId("state")
    await expect(state).toHaveText("todo:a,b,c doing:d,e done:")

    await page.getByTestId("d").focus()
    await page.keyboard.press("Space")
    await page.keyboard.press("ArrowDown")
    await expect(state).toHaveText("todo:a,b,c doing:e,d done:")

    await page.getByTestId("a").click()
    await page.keyboard.press("ArrowUp")
    await page.keyboard.press("ArrowLeft")
    // Neither key moves d any more
    await page.waitForTimeout(100)
    await expect(state).toHaveText("todo:a,b,c doing:e,d done:")
})
