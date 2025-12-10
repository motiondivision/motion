describe("Scroll progress in reverse-direction containers", () => {
    beforeEach(() => {
        cy.visit("?test=scroll-reverse").wait(100)
    })

    it("Correctly calculates progress for flex-direction: column-reverse", () => {
        // Check initial progress
        cy.get("#progress-col-reverse").should("have.text", "0.000")

        // Scroll to middle and check progress
        cy.get("#scroller-col-reverse")
            .scrollTo("center")
            .wait(100)
            .get("#progress-col-reverse")
            .should(($element) => {
                expect(parseFloat($element.text())).to.be.closeTo(0.5, 0.01)
            })

        // Scroll to end and check progress
        cy.get("#scroller-col-reverse")
            .scrollTo("bottom")
            .wait(100)
            .get("#progress-col-reverse")
            .should(($element) => {
                expect(parseFloat($element.text())).to.be.closeTo(1.0, 0.01)
            })
    })

    it("Correctly calculates progress for flex-direction: row-reverse", () => {
        // Check initial progress
        cy.get("#progress-row-reverse").should("have.text", "0.000")

        // Scroll to middle and check progress
        cy.get("#scroller-row-reverse")
            .scrollTo("center")
            .wait(100)
            .get("#progress-row-reverse")
            .should(($element) => {
                expect(parseFloat($element.text())).to.be.closeTo(0.5, 0.01)
            })

        // Scroll to end and check progress
        cy.get("#scroller-row-reverse")
            .scrollTo("right")
            .wait(100)
            .get("#progress-row-reverse")
            .should(($element) => {
                expect(parseFloat($element.text())).to.be.closeTo(1.0, 0.01)
            })
    })

    it("Correctly calculates progress for direction: rtl", () => {
        // Check initial progress
        cy.get("#progress-rtl").should("have.text", "0.000")

        // Scroll to middle and check progress
        cy.get("#scroller-rtl")
            .scrollTo("center")
            .wait(100)
            .get("#progress-rtl")
            .should(($element) => {
                expect(parseFloat($element.text())).to.be.closeTo(0.5, 0.01)
            })

        // Scroll to end and check progress
        cy.get("#scroller-rtl")
            .scrollTo("left") // For RTL, the "end" is to the left
            .wait(100)
            .get("#progress-rtl")
            .should(($element) => {
                expect(parseFloat($element.text())).to.be.closeTo(1.0, 0.01)
            })
    })
})
