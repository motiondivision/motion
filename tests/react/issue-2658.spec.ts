import { expect, Page, test } from "@playwright/test"

/**
 * #2658: Space grabs the focused Reorder.Item, arrows move it, Space
 * drops it and Escape cancels. The grab has to survive React
 * moving the node, which blurs it before React refocuses it, and has to end
 * when focus really leaves. Only a real browser checks either: JSDOM doesn't
 * blur an element when it's moved.
 */
const order = (page: Page) => page.locator("#order").textContent()
const focused = (page: Page) => page.evaluate(() => document.activeElement?.id)
/**
 * Grabbed items show their whileDrag opacity, read after it has rendered.
 */
const grabbed = (page: Page) =>
    page.evaluate(async () => {
        await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
        )
        return Array.from(document.querySelectorAll("li"))
            .filter((element) => getComputedStyle(element).opacity === "0.5")
            .map((element) => element.id)
            .join(",")
    })
const scrollY = (page: Page) => page.evaluate(() => window.scrollY)
const press = (page: Page, key: string) => page.keyboard.press(key)

test.describe("Issue #2658: keyboard reordering", () => {
    test("arrows move focus until Space grabs, then move until Space drops", async ({
        page,
    }) => {
        await page.goto("?test=issue-2658")
        await page.focus("#before")
        await press(page, "Tab")
        expect(await focused(page)).toBe("a")

        // Not grabbed: the arrows move focus
        await press(page, "ArrowDown")
        expect(await focused(page)).toBe("b")
        await press(page, "ArrowUp")
        expect(await focused(page)).toBe("a")
        expect(await order(page)).toBe("a,b,c,d")

        await press(page, "Space")
        await expect.poll(() => grabbed(page)).toBe("a")

        await press(page, "ArrowDown")
        expect(await order(page)).toBe("b,a,c,d")
        expect(await focused(page)).toBe("a")
        await expect.poll(() => grabbed(page)).toBe("a")

        await press(page, "ArrowDown")
        await press(page, "ArrowDown")
        expect(await order(page)).toBe("b,c,d,a")
        expect(await focused(page)).toBe("a")
        await expect.poll(() => grabbed(page)).toBe("a")

        // Past the end
        await press(page, "ArrowDown")
        expect(await order(page)).toBe("b,c,d,a")

        await press(page, "ArrowUp")
        expect(await order(page)).toBe("b,c,a,d")
        expect(await focused(page)).toBe("a")

        // Across the axis
        await press(page, "ArrowRight")
        expect(await order(page)).toBe("b,c,a,d")

        await press(page, "Space")
        await expect.poll(() => grabbed(page)).toBe("")
        await press(page, "ArrowUp")
        expect(await order(page)).toBe("b,c,a,d")
        expect(await focused(page)).toBe("c")

        // Neither Space nor the arrows scrolled the page
        await page.waitForTimeout(200)
        expect(await scrollY(page)).toBe(0)
    })

    test("Enter doesn't grab", async ({ page }) => {
        await page.goto("?test=issue-2658")
        await page.focus("#b")
        await press(page, "Enter")
        await expect.poll(() => grabbed(page)).toBe("")
        await press(page, "ArrowUp")
        expect(await order(page)).toBe("a,b,c,d")
    })

    test("Escape restores the order from the grab", async ({ page }) => {
        await page.goto("?test=issue-2658")
        await page.focus("#b")
        await press(page, "Space")
        await press(page, "ArrowDown")
        await press(page, "ArrowDown")
        expect(await order(page)).toBe("a,c,d,b")

        await press(page, "Escape")
        expect(await order(page)).toBe("a,b,c,d")
        await expect.poll(() => grabbed(page)).toBe("")
        expect(await focused(page)).toBe("b")

        await press(page, "ArrowDown")
        expect(await order(page)).toBe("a,b,c,d")
    })

    test("the grab and focus survive a held key", async ({ page }) => {
        await page.goto("?test=issue-2658")
        await page.focus("#d")
        await press(page, "Space")
        for (let i = 0; i < 3; i++) {
            await page.keyboard.down("ArrowUp")
        }
        await page.keyboard.up("ArrowUp")
        expect(await order(page)).toBe("d,a,b,c")
        expect(await focused(page)).toBe("d")
        await expect.poll(() => grabbed(page)).toBe("d")
    })

    test("moving an item up keeps focus and the grab", async ({ page }) => {
        // React moves a different node depending on direction
        await page.goto("?test=issue-2658")
        await page.focus("#c")
        await press(page, "Space")
        await press(page, "ArrowUp")
        expect(await order(page)).toBe("a,c,b,d")
        expect(await focused(page)).toBe("c")
        await expect.poll(() => grabbed(page)).toBe("c")
        await press(page, "ArrowUp")
        expect(await order(page)).toBe("c,a,b,d")
    })

    test("a reorder in a transition keeps focus and the grab", async ({
        page,
    }) => {
        await page.goto("?test=issue-2658&transition")
        await page.focus("#b")
        await press(page, "Space")
        await press(page, "ArrowDown")
        await expect.poll(() => order(page)).toBe("a,c,b,d")
        await press(page, "ArrowUp")
        await expect.poll(() => order(page)).toBe("a,b,c,d")
        await press(page, "ArrowUp")
        await expect.poll(() => order(page)).toBe("b,a,c,d")
        expect(await focused(page)).toBe("b")
        await expect.poll(() => grabbed(page)).toBe("b")

        await press(page, "Escape")
        await expect.poll(() => order(page)).toBe("a,b,c,d")
        await expect.poll(() => grabbed(page)).toBe("")
    })

    test("Tab away drops, keeping the order", async ({ page }) => {
        await page.goto("?test=issue-2658")
        await page.focus("#a")
        await press(page, "Space")
        await press(page, "ArrowDown")
        await press(page, "Tab")
        expect(await focused(page)).toBe("a-input")
        await expect.poll(() => grabbed(page)).toBe("")
        expect(await order(page)).toBe("b,a,c,d")

        await press(page, "Shift+Tab")
        expect(await focused(page)).toBe("a")
        await press(page, "ArrowDown")
        expect(await order(page)).toBe("b,a,c,d")
    })

    test("clicking elsewhere drops, keeping the order", async ({ page }) => {
        await page.goto("?test=issue-2658")
        await page.focus("#a")
        await press(page, "Space")
        await press(page, "ArrowDown")
        await page.mouse.click(400, 600)
        expect(await focused(page)).not.toBe("a")
        await expect.poll(() => grabbed(page)).toBe("")
        expect(await order(page)).toBe("b,a,c,d")
    })

    test("whileDrag applies while grabbed", async ({ page }) => {
        await page.goto("?test=issue-2658")
        const opacity = () =>
            page.$eval("#a", (element) => getComputedStyle(element).opacity)
        await page.focus("#a")
        expect(await opacity()).toBe("1")

        await press(page, "Space")
        await expect.poll(opacity).toBe("0.5")
        await press(page, "ArrowDown")
        await page.waitForTimeout(100)
        expect(await opacity()).toBe("0.5")

        await press(page, "Space")
        await expect.poll(opacity).toBe("1")

        await press(page, "Space")
        await expect.poll(opacity).toBe("0.5")
        await page.focus("#before")
        await expect.poll(opacity).toBe("1")
    })

    test("keys inside an item don't grab or reorder", async ({ page }) => {
        await page.goto("?test=issue-2658")
        await page.focus("#a-input")
        await press(page, "Space")
        await press(page, "Enter")
        await press(page, "ArrowDown")
        await press(page, "ArrowRight")
        await expect.poll(() => grabbed(page)).toBe("")
        expect(await order(page)).toBe("a,b,c,d")
        expect(
            await page.$eval(
                "#a-input",
                (input: HTMLInputElement) => input.value
            )
        ).toBe(" ")
    })

    test("x axis and RTL", async ({ page }) => {
        await page.goto("?test=issue-2658&axis=x")
        await page.focus("#a")
        await press(page, "Space")
        await press(page, "ArrowRight")
        expect(await order(page)).toBe("b,a,c,d")
        expect(await focused(page)).toBe("a")

        await page.goto("?test=issue-2658&axis=x&rtl")
        await page.focus("#a")
        await press(page, "Space")
        await press(page, "ArrowLeft")
        expect(await order(page)).toBe("b,a,c,d")
        expect(await focused(page)).toBe("a")
    })

    test("the reorder layout-animates", async ({ page }) => {
        await page.goto("?test=issue-2658&layout")
        await page.focus("#a")
        await press(page, "Space")
        const before = await page.locator("#a").boundingBox()
        await press(page, "ArrowDown")
        await page.waitForTimeout(500)
        const mid = await page.locator("#a").boundingBox()
        // 50px per slot (40px + 10px gap); halfway through a 1s linear move
        expect(mid!.y - before!.y).toBeGreaterThan(10)
        expect(mid!.y - before!.y).toBeLessThan(40)
        expect(await focused(page)).toBe("a")
        await expect.poll(() => grabbed(page)).toBe("a")
    })
})
