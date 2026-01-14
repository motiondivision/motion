import { test, expect } from "@playwright/test"

test.describe("animateLayout", () => {
    test("interrupted animations should start from visual position, not layout position", async ({
        page,
    }) => {
        // Capture console logs
        const logs: string[] = []
        page.on("console", (msg) => {
            logs.push(msg.text())
        })

        await page.goto(
            "http://localhost:8000/animate-layout/interrupt-animation.html"
        )

        // Wait for the test to complete (animation is 0.5s + 0.25s wait + some extra)
        await page.waitForTimeout(1500)

        // Print logs for debugging
        console.log("Console logs:", logs)

        // Check that no elements have data-layout-correct="false"
        const incorrectElements = await page.locator(
            '[data-layout-correct="false"]'
        )
        await expect(incorrectElements).toHaveCount(0)
    })
})
