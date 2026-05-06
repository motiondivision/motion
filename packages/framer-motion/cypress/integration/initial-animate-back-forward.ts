const PAGE = "?test=initial-animate-back-forward"
const OTHER = "?test=initial-animate-back-forward-other"

describe("initial → animate after browser back/forward (#3676)", () => {
    it("animates to opacity 1 after navigating away mid-animation and pressing back", () => {
        cy.visit(PAGE).wait(100).get("#box").should("exist")
        cy.visit(OTHER).get("#other-page").should("exist")
        cy.go("back")
            .get("#box")
            .should(($el: any) => {
                const opacity = parseFloat(
                    window.getComputedStyle($el[0]).opacity
                )
                expect(opacity).to.equal(1)
            })
    })

    it("animates to opacity 1 after pressing back then forward", () => {
        cy.visit(PAGE)
            .get("#box")
            .should(($el: any) => {
                const opacity = parseFloat(
                    window.getComputedStyle($el[0]).opacity
                )
                expect(opacity).to.equal(1)
            })
        cy.visit(OTHER).get("#other-page").should("exist")
        cy.go("back").get("#box").should("exist")
        cy.go("forward").get("#other-page").should("exist")
        cy.go("back")
            .get("#box")
            .should(($el: any) => {
                const opacity = parseFloat(
                    window.getComputedStyle($el[0]).opacity
                )
                expect(opacity).to.equal(1)
            })
    })
})
