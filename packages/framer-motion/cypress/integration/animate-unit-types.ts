describe("Unit conversion", () => {
    it("animates height: auto correctly", () => {
        cy.visit("?test=animate-height")
            .wait(200)
            .get("#test")
            .should(([$element]: any) => {
                expect($element.innerText).not.to.equal("Error")
            })
    })

    it("animates height: auto correctly even when animating display", () => {
        cy.visit("?test=animate-height-with-display")
            .wait(200)
            .get("#test")
            .should(([$element]: any) => {
                expect($element.innerText).not.to.equal("Error")
            })
    })

    it("animates translation from px to percent", () => {
        cy.visit("?test=animate-x-percent")
            .wait(200)
            .get("#test")
            .should(([$element]: any) => {
                expect($element.innerText).not.to.equal("Error")
            })
    })
})
