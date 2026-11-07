import { expect, test } from "@playwright/test"

/**
 * Springs defined by visualDuration inherit the velocity of the
 * animation they interrupt, as physics springs do.
 */
const transitions = [
    { type: "spring", stiffness: 200, damping: 20 },
    { type: "spring", visualDuration: 0.5, bounce: 0.2 },
    { type: "spring", visualDuration: 0.5, bounce: 0 },
]

for (const transition of transitions) {
    test(`interrupted spring inherits velocity: ${JSON.stringify(
        transition
    )}`, async ({ page }) => {
        await page.goto("animate/animate-time-spring-velocity.html")
        const results = await page.evaluate(
            (t) => (window as any).run(t),
            transition
        )

        // Still moving towards the first target after the reversal
        expect(results.opacity.after).toBeGreaterThan(results.opacity.before)
        expect(results.x.after).toBeGreaterThan(results.x.before)

        expect(results.opacity.final).toBe(0)
        expect(results.x.final).toBe(0)
    })
}
