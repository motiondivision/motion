/**
 * Tests for AnimateSuspense (issue #3173).
 *
 * Covers:
 *   1. Suspended children: fallback appears, exits when content resolves.
 *   2. Non-suspending children: fallback must never mount (no initial flash).
 */
describe("AnimateSuspense", () => {
    it("animates fallback out when suspended children resolve", () => {
        cy.visit("?test=animate-suspense&mode=suspend")
            .wait(100)
            // Fallback visible while suspended.
            .get("#fallback")
            .should("exist")

            // Content appears after lazy import resolves (~500ms).
            .get("#content", { timeout: 5000 })
            .should("exist")
            .should("contain", "Loaded Content")

            // Fallback exits after its exit animation completes.
            .get("#fallback", { timeout: 5000 })
            .should("not.exist")
    })

    it("does not render fallback when children do not suspend", () => {
        cy.visit("?test=animate-suspense&mode=sync")
            .wait(200)
            .get("#content")
            .should("exist")
            .should("contain", "Sync Content")
            .window()
            .then((win) => {
                const count = (
                    win as unknown as { __fallbackMountCount?: number }
                ).__fallbackMountCount
                expect(count).to.equal(0)
            })
    })
})
