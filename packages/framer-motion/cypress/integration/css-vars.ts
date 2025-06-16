describe("CSS variables", () => {
    it("Numerical CSS var values are resolved and animated correctly", () => {
        cy.visit("?test=css-vars")
            .wait(100)
            .get("#test")
            .should(([$element]: any) => {
                expect($element.textContent).to.equal("Success")
            })
    })
})
