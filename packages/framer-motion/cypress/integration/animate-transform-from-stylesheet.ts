describe("Independent transforms", () => {
    it("animate from a stylesheet transform", () => {
        cy.visit("?test=animate-transform-from-stylesheet")
            .wait(5000)
            .get("#box")
            .then(([element]: any) => {
                const win = element.ownerDocument.defaultView
                const { m41 } = new win.DOMMatrix(
                    win.getComputedStyle(element).transform
                )
                expect(m41).to.be.within(135, 165)
            })
    })
})
