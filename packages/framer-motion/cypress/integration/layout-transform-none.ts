describe("Layout animation with a 'none' transform value", () => {
    it("Still applies the projection transform", () => {
        cy.visit("?test=layout-transform-none")
            .wait(500)
            .get("#box")
            .trigger("click")
            .wait(5000)
            .then(([box]: any) => {
                expect(box.getBoundingClientRect().left).to.be.within(150, 250)
            })
    })
})
