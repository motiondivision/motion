import { expect, Page, test } from "@playwright/test"

async function drag(page: Page, id: string, dx: number) {
    const box = (await page.getByTestId(id).boundingBox())!
    const x = box.x + 10
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    for (let i = 1; i <= 20; i++) {
        await page.mouse.move(x + (dx * i) / 20, y)
        await page.waitForTimeout(30)
    }
    await page.mouse.up()
}

test.describe("issue 2255: Reorder.Item in a wrapping axis=\"x\" group", () => {
    test("dragged item settles into its layout position with no leftover translateY", async ({
        page,
    }) => {
        await page.goto("/?test=issue-2255")
        const apple = page.getByTestId("apple")
        await apple.waitFor()

        // Drag "apple" horizontally far enough to move it into a later row
        await drag(page, "apple", 220)
        await page.waitForTimeout(1000)

        const order = await page.getByTestId("order").textContent()
        expect(order).not.toBe(
            "apple,banana,kiwi,watermelon,fig,grape,pear"
        )

        // Once the drag has ended and the snap-back animation has finished,
        // the item should sit at its laid-out position: no y offset.
        const { transform, offsetTop, visualTop } = await apple.evaluate(
            (el: HTMLElement) => ({
                transform: el.style.transform,
                offsetTop: el.offsetTop - el.parentElement!.offsetTop,
                visualTop:
                    el.getBoundingClientRect().top -
                    el.parentElement!.getBoundingClientRect().top,
            })
        )
        expect(transform).not.toMatch(/translateY|translate3d/)
        expect(visualTop).toBeCloseTo(offsetTop, 0)
    })
})
