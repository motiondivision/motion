/**
 * #3779: WAAPI finish commits SVG opacity to inline style; duration: 0
 * then only updates the opacity attribute. Stale style.opacity: 0 wins
 * over attribute opacity="1", so the element never reappears.
 */
describe("SVG WAAPI duration 0 (#3779)", () => {
    it("Restores SVG opacity when a duration: 0 animation follows a WAAPI fade-out", () => {
        cy.visit("?test=svg-waapi-duration-0")
            .get("#target")
            .should(([$el]: any) => {
                expect(getComputedStyle($el).opacity).to.equal("1")
            })
            .get("#toggle")
            .click()
            // Wait for the non-zero duration fade-out to finish
            .get("#target")
            .should(([$el]: any) => {
                expect(getComputedStyle($el).opacity).to.equal("0")
            })
            .get("#toggle")
            .click()
            // duration: 0 must restore visibility (attribute + computed style)
            .get("#target")
            .should(([$el]: any) => {
                expect(getComputedStyle($el).opacity).to.equal("1")
                expect($el.getAttribute("opacity")).to.equal("1")
                // Inline style from WAAPI must not linger and override the attr
                expect($el.style.opacity).to.equal("")
            })
    })
})
