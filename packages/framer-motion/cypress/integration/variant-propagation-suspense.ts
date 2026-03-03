/**
 * Test for issue #3562: Variant propagation lost for children that mount
 * asynchronously via React.lazy + Suspense.
 *
 * When a parent animates from "hidden" to "visible" and a child mounts
 * asynchronously (after the parent has already committed), the child should
 * still animate from its "hidden" variant rather than jumping directly to
 * its "visible" values.
 */
describe("Variant propagation to lazy-loaded Suspense children", () => {
    it("child should animate from initial variant, not jump to animate values", () => {
        cy.visit("?test=variant-propagation-suspense")
            // Wait for the lazy module to load and the child to mount
            .get("#child", { timeout: 2000 })
            // Check immediately after mount — opacity should be near 0,
            // not 1 (which would mean it skipped the animation)
            .should(([$child]: any) => {
                const opacity = parseFloat($child.style.opacity)
                // If the bug is present, opacity jumps straight to 1.
                // With the fix, opacity starts at 0 and animates up.
                expect(opacity).to.be.lessThan(0.5)
            })
    })

    it("child should reach final animate variant values after animation completes", () => {
        cy.visit("?test=variant-propagation-suspense")
            .get("#child", { timeout: 2000 })
            // After ~3s total (100ms load + 2s animation + buffer), should be at 1
            .wait(3000)
            .should(([$child]: any) => {
                const opacity = parseFloat($child.style.opacity)
                expect(opacity).to.equal(1)
            })
    })
})
