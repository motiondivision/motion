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

    it("Restores SVG transform with a zero-duration animation", () => {
        cy.visit("?test=waapi-svg-zero-duration")
            .get("#toggle")
            .click()
            .wait(400)
            .get("#transform-target")
            .then(([$target]: any) => {
                expect($target.style.transform).to.equal("translateX(50px)")
            })
            .get("#toggle")
            .click()
            .wait(50)
            .get("#transform-target")
            .then(([$target]: any) => {
                expect($target.style.transform).to.equal("translateX(0px)")
            })
    })
})
