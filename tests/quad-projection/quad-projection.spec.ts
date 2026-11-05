import { expect, test } from "@playwright/test"
import { readdirSync } from "fs"
import { join } from "path"

/**
 * Each page runs its own assertions, flagging failures with
 * data-layout-correct="false", and sets data-done on <body> when finished.
 * Cypress runs the same pages in CI, via cypress/integration-html.
 */
const pages = readdirSync(
    join(__dirname, "../../dev/html/public/quad-projection")
).filter((name) => name.endsWith(".html"))

test.describe("quad projection", () => {
    for (const name of pages) {
        test(name, async ({ page }) => {
            const errors: string[] = []
            page.on("console", (message) => {
                if (message.type() === "error") errors.push(message.text())
            })
            page.on("pageerror", (error) => errors.push(error.message))

            await page.goto(`/quad-projection/${name}`)
            await expect(page.locator("body")).toHaveAttribute(
                "data-done",
                "true",
                { timeout: 10000 }
            )

            expect(errors).toEqual([])
            await expect(
                page.locator('[data-layout-correct="false"]')
            ).toHaveCount(0)
        })
    }
})
