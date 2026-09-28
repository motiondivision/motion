describe("Layout animation with a 'none' transform value", () => {
    it("Still applies the projection transform", () => {
        cy.visit("?test=layout-transform-none")
            .wait(500)
            .get("#move")
            .trigger("click")
            .wait(5000)
            .then(() => {
                cy.window().then((win) => {
                    for (const id of ["rotate", "x", "scale"]) {
                        const box = win.document.getElementById(id)!
                        const { left, width } = box.getBoundingClientRect()
                        expect(left, id).to.be.within(150, 250)
                        expect(width, id).to.be.closeTo(100, 1)
                    }
                })
            })
    })
})
