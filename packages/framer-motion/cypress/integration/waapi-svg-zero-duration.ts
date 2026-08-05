describe("waapi-svg-zero-duration", () => {
    it("Restores SVG opacity with a zero-duration animation", () => {
        cy.visit("?test=waapi-svg-zero-duration")
            .get("#toggle")
            .click()
            .wait(400)
            .get("#chip")
            .then(([$chip]: any) => {
                expect(getComputedStyle($chip).opacity).to.equal("0")
            })
            .get("#toggle")
            .click()
            .wait(50)
            .get("#chip")
            .then(([$chip]: any) => {
                expect(getComputedStyle($chip).opacity).to.equal("1")
            })
    })
})
