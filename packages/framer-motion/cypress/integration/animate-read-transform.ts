describe("animate() x read transform value", () => {
    it("correctly reads and animates transform values", () => {
        cy.visit("?test=animate-read-transform")
            .wait(500)
            .get(".translate")
            .should(($el) => {
                const transform = $el[0].style.transform
                expect(transform).to.include("translateX(150px)")
            })

        cy.get(".rotate").should(($el) => {
            const transform = $el[0].style.transform
            expect(transform).to.include("rotate(95deg)")
        })

        cy.get(".scale").should(($el) => {
            const transform = $el[0].style.transform
            expect(transform).to.include("scale(3)")
        })
    })
})
