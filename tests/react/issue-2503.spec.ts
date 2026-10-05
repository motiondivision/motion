import { expect, Page, test } from "@playwright/test"

/**
 * #2503 — AnimatePresence mode="popLayout" doesn't pop the exiting child out
 * of the layout when the child is a function component that can't hold a ref
 * (react-router's <Routes> in the report).
 */

interface Measured {
    position: string
    hasPopId: boolean
    top: number
    left: number
}

async function measure(page: Page, id: string): Promise<Measured | null> {
    return page.evaluate((elementId) => {
        const element = document.getElementById(elementId)
        if (!element) return null
        const { position } = getComputedStyle(element)
        const box = element.getBoundingClientRect()
        return {
            position,
            hasPopId: element.hasAttribute("data-motion-pop-id"),
            top: box.top,
            left: box.left,
        }
    }, id)
}

function collectWarnings(page: Page): string[] {
    const warnings: string[] = []
    page.on("console", (message) => {
        if (message.type() === "error" || message.type() === "warning") {
            warnings.push(message.text())
        }
    })
    return warnings
}

test.describe("Issue #2503", () => {
    test("pops a non-forwardRef function component child out of the layout", async ({
        page,
    }) => {
        const warnings = collectWarnings(page)

        await page.goto("?test=issue-2503&variant=plain")
        await expect(page.locator("#first")).toBeVisible()

        const firstBefore = await measure(page, "first")

        await page.click("#toggle")
        await expect(page.locator("#second")).toBeVisible()

        // Exit transition is 10s, so both are in the DOM here.
        const exiting = await measure(page, "first")
        const entering = await measure(page, "second")

        // eslint-disable-next-line no-console
        console.log(
            JSON.stringify({ firstBefore, exiting, entering, warnings })
        )

        expect(exiting).not.toBeNull()

        // The exiting child should be popped out of the layout...
        expect(exiting!.hasPopId).toBe(true)
        expect(exiting!.position).toBe("absolute")

        // ...so the entering child takes the exiting child's place.
        expect(Math.abs(entering!.top - firstBefore!.top)).toBeLessThan(2)

        // ...and no ref warning is logged.
        expect(
            warnings.filter((text) =>
                /Function components cannot be given refs|Cannot assign to read only|Accessing element\.ref/.test(
                    text
                )
            )
        ).toEqual([])
    })

    /**
     * In React 19 refs are passed via props, so a function component that
     * spreads its props onto a host element receives PopChild's ref even
     * without forwardRef. In React 18 it does not.
     */
    test("spread-props function component child", async ({ page }) => {
        const warnings = collectWarnings(page)

        await page.goto("?test=issue-2503&variant=spread")
        await expect(page.locator("#first")).toBeVisible()

        const reactMajor = Number(
            (await page.locator("#react-version").textContent())!.split(".")[0]
        )
        test.skip(
            reactMajor < 19,
            "React 18 doesn't pass refs via props, so this variant can't work"
        )

        const firstBefore = await measure(page, "first")

        await page.click("#toggle")
        await expect(page.locator("#second")).toBeVisible()

        const exiting = await measure(page, "first")
        const entering = await measure(page, "second")

        // eslint-disable-next-line no-console
        console.log(
            JSON.stringify({
                variant: "spread",
                firstBefore,
                exiting,
                entering,
                warnings,
            })
        )

        expect(exiting!.hasPopId).toBe(true)
        expect(exiting!.position).toBe("absolute")
        expect(Math.abs(entering!.top - firstBefore!.top)).toBeLessThan(2)
    })

    test("pops a forwardRef function component child out of the layout", async ({
        page,
    }) => {
        await page.goto("?test=issue-2503&variant=forwardref")
        await expect(page.locator("#first")).toBeVisible()

        const firstBefore = await measure(page, "first")

        await page.click("#toggle")
        await expect(page.locator("#second")).toBeVisible()

        const exiting = await measure(page, "first")
        const entering = await measure(page, "second")

        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ firstBefore, exiting, entering }))

        expect(exiting!.hasPopId).toBe(true)
        expect(exiting!.position).toBe("absolute")
        expect(Math.abs(entering!.top - firstBefore!.top)).toBeLessThan(2)
    })
})
