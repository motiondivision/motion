describe("animate() with autoplay: false", () => {
    it("does not start WAAPI animation when autoplay is false", () => {
        cy.visit("?test=animate-autoplay-false")
            .wait(200)
            .get("#box")
            .should(($el: any) => {
                // opacity should remain at 1 since autoplay is false
                const opacity = parseFloat(
                    getComputedStyle($el[0]).opacity
                )
                expect(opacity).to.equal(1)
            })
    })
})
