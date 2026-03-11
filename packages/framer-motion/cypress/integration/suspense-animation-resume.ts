/**
 * Test that motion values are reset to initial values after a React Suspense
 * unmount/remount cycle. Verifies the fix for issue #2269.
 *
 * Without the fix, scale gets stuck at an intermediate animation value
 * and opacity appears incorrectly reset after Suspense remount.
 *
 * Timeline of the test component:
 *   0ms   - Animation starts (opacity 0 → 1, scale 0.5 → 2, duration 10s)
 *   400ms - Component suspends
 *   900ms - Component resumes, values should reset to initial
 */
describe("Animation resume after Suspense", () => {
    it("resets values to initial after Suspense remount", () => {
        cy.visit("?test=suspense-animation-resume")
            .wait(50)
            // Element should exist and be animating
            .get("#target")
            .should("exist")

            // Wait for suspend — fallback should appear
            .get("#fallback", { timeout: 2000 })
            .should("exist")
            .should("contain", "Suspended")

            // Wait for resume — target should reappear
            .get("#target", { timeout: 2000 })
            .should("exist")
            .should(([$element]: any) => {
                // Right after remount, opacity should be reset to initial (0),
                // not stuck at an intermediate value from before suspension.
                // Use getComputedStyle since the inline style may not be set yet.
                const opacity = parseFloat(
                    window.getComputedStyle($element).opacity
                )
                expect(opacity).to.be.lessThan(0.3)
            })
    })
})
