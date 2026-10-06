import { expect, test } from "@playwright/test"

/**
 * Each scenario records the element's position every frame while an
 * accelerated transform animation is handed to the main thread, and reports
 * any frame that stalled, jumped or ran at the wrong speed. See
 * dev/react/src/tests/pooled-handoff.tsx.
 */
const scenarios = [
    "interrupt-sibling",
    "late-join",
    "sibling-main-thread",
    "restart",
    "stop",
    "speed",
    "paused",
    "delay",
    "exit-mode",
    "set-sibling",
    "spring",
    "component-interrupt",
    "component-sibling",
    "component-stop",
]

test.describe("pooled transforms: hand-off to the main thread", () => {
    for (const scenario of scenarios) {
        test(`${scenario} has no dropped or jumped frames`, async ({
            page,
        }) => {
            await page.goto(`?test=pooled-handoff&scenario=${scenario}`)

            const result = page.locator("#result")
            await expect(result).not.toBeEmpty({ timeout: 10000 })

            const { drops, samples } = JSON.parse(
                (await result.textContent()) || "{}"
            )
            expect(samples.length).toBeGreaterThan(30)
            expect(drops).toEqual([])
        })
    }
})
