/**
 * Playwright mirror of
 * packages/framer-motion/cypress/integration/drag-layout-reorder-strict.ts:
 * a dragged element whose own layout changes (content inserted above it) must
 * stay under the pointer rather than layout-animating to its new slot.
 */
import { expect, test } from "@playwright/test"

test("dragged element stays put when content is inserted above", async ({
    page,
}) => {
    await page.goto("?test=drag-layout-reorder-strict")
    const file = page.locator("[data-testid='file-File1']")
    await expect(file).toBeVisible()
    await page.waitForTimeout(200)

    const start = await file.boundingBox()
    await page.mouse.move(start!.x + 50, start!.y + 7)
    await page.mouse.down()
    await page.mouse.move(start!.x + 50, start!.y + 12, { steps: 2 })
    await page.waitForTimeout(50)
    await page.mouse.move(start!.x + 50, start!.y + 72, { steps: 5 })
    await page.waitForTimeout(200)

    const preExpand = (await file.boundingBox())!.y

    await page.evaluate(() => (window as any).expandFolder("Folder1"))
    await page.waitForTimeout(500)

    await expect(
        page.locator("[data-testid='placeholder-Existing1a']")
    ).toHaveCount(1)

    const postExpand = (await file.boundingBox())!.y
    await page.mouse.up()

    expect(Math.abs(postExpand - preExpand)).toBeLessThan(50)
})
