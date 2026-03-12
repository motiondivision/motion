/**
 * Tests for the arc feature on layout animations (transition.layout.arc).
 *
 * The test page uses `ease: () => 0.5` inside `transition.layout` to freeze
 * the animation at exactly 50% progress, making it easy to sample the
 * mid-arc position without fighting timing.
 *
 * Setup:
 *   item-a: left=50,  top=200, width=100, height=50
 *   item-b: left=450, top=200, width=100, height=50  (400px apart, same top)
 *   item-b (small variant): left=60 — only 10px apart, below 20px threshold
 *
 * With amplitude=1 and 400px horizontal travel, the perpendicular displacement
 * at t=0.5 is ≈200px, so the indicator top should be near 0 or 400 (not 200).
 */

describe("layout arc", () => {
    it("deviates from the straight-line path mid-animation", () => {
        cy.visit("?test=layout-arc")
            .wait(50)
            // Confirm starting position
            .get("#indicator")
            .should(([$el]: any) => {
                const { top } = $el.getBoundingClientRect()
                expect(top).to.be.closeTo(200, 10)
            })
            // Trigger shared layout animation
            .get("#toggle")
            .click()
            .wait(100)
            // At 50% progress the arc displaces the element ~200px from baseline
            .get("#indicator")
            .should(([$el]: any) => {
                const { top } = $el.getBoundingClientRect()
                expect(Math.abs(top - 200)).to.be.greaterThan(80)
            })
    })

    it("stays on the straight-line path without arc config", () => {
        cy.visit("?test=layout-arc&variant=none")
            .wait(50)
            .get("#indicator")
            .should(([$el]: any) => {
                const { top } = $el.getBoundingClientRect()
                expect(top).to.be.closeTo(200, 10)
            })
            .get("#toggle")
            .click()
            .wait(100)
            // No arc — y stays at ≈200 throughout
            .get("#indicator")
            .should(([$el]: any) => {
                const { top } = $el.getBoundingClientRect()
                expect(top).to.be.closeTo(200, 20)
            })
    })

    it("does not arc for movements below the 20px minimum distance", () => {
        cy.visit("?test=layout-arc&variant=small")
            .wait(50)
            .get("#indicator")
            .should(([$el]: any) => {
                const { top } = $el.getBoundingClientRect()
                expect(top).to.be.closeTo(200, 10)
            })
            .get("#toggle")
            .click()
            .wait(100)
            // 10px movement — below threshold, stays linear
            .get("#indicator")
            .should(([$el]: any) => {
                const { top } = $el.getBoundingClientRect()
                expect(top).to.be.closeTo(200, 20)
            })
    })
})
