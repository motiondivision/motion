/**
 * Test for AnimateSuspense component (issue #3173).
 *
 * Verifies that:
 * 1. The fallback is visible while children are suspended
 * 2. The content appears when children resolve
 * 3. The fallback animates out (exit animation) after resolve
 */
describe("AnimateSuspense", () => {
    it("shows fallback while suspended, then animates it out on resolve", () => {
        cy.visit("?test=animate-suspense")
            .wait(100)
            // Fallback should be visible while children are suspended
            .get("#fallback")
            .should("exist")
            .should("have.css", "opacity", "1")

            // Wait for content to appear (promise resolves at ~500ms)
            .get("#content", { timeout: 5000 })
            .should("exist")
            .should("contain", "Loaded Content")

            // Fallback should be removed after exit animation completes
            .get("#fallback", { timeout: 5000 })
            .should("not.exist")
    })
})
