/**
 * #3779: SVG opacity must render as CSS style (same target as WAAPI).
 * Transform already uses style — assert duration: 0 after WAAPI still works.
 */
describe("SVG WAAPI duration 0 (#3779)", () => {
    it("Restores SVG opacity via style when duration: 0 follows a WAAPI fade-out", () => {
        cy.visit("?test=svg-waapi-duration-0")
            .get("#opacity-target")
            .should(([$el]: any) => {
                expect(getComputedStyle($el).opacity).to.equal("1")
            })
            .get("#opacity-toggle")
            .click()
            .get("#opacity-target")
            .should(([$el]: any) => {
                expect(getComputedStyle($el).opacity).to.equal("0")
            })
            .get("#opacity-toggle")
            .click()
            .get("#opacity-target")
            .should(([$el]: any) => {
                expect(getComputedStyle($el).opacity).to.equal("1")
                expect($el.style.opacity).to.equal("1")
            })
    })

    it("Restores SVG transform via style when duration: 0 follows a WAAPI animation", () => {
        cy.visit("?test=svg-waapi-duration-0")
            .get("#transform-target")
            .should(([$el]: any) => {
                expect($el.style.transform).to.equal("translateX(0px)")
            })
            .get("#transform-toggle")
            .click()
            .get("#transform-target")
            .should(([$el]: any) => {
                expect($el.style.transform).to.equal("translateX(50px)")
            })
            .get("#transform-toggle")
            .click()
            .get("#transform-target")
            .should(([$el]: any) => {
                expect($el.style.transform).to.equal("translateX(0px)")
            })
    })
})
