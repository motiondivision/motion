function getMatrix(element: HTMLElement) {
    const { transform } =
        element.ownerDocument.defaultView!.getComputedStyle(element)
    const match = transform.match(/^matrix\((.+)\)$/u)
    return match ? match[1].split(",").map(parseFloat) : [1, 0, 0, 1, 0, 0]
}

describe("Stylesheet transforms", () => {
    it("animate from the stylesheet value, not the default", () => {
        cy.visit("?test=animate-stylesheet-transform")
            .wait(5000)
            .get("#x")
            .then(([element]: any) => {
                expect(getMatrix(element)[4]).to.be.within(135, 165)
            })
            .get("#layout-x")
            .then(([element]: any) => {
                expect(getMatrix(element)[4]).to.be.within(135, 165)
            })
            .get("#scale")
            .then(([element]: any) => {
                expect(getMatrix(element)[0]).to.be.within(2.35, 2.65)
            })
    })

    it("don't read transformTemplate output as the origin", () => {
        cy.visit("?test=animate-stylesheet-transform")
            .wait(5000)
            .get("#template")
            .then(([element]: any) => {
                // translateX(-50%) of 400px, plus x halfway from 0 to 200
                expect(getMatrix(element)[4]).to.be.within(-130, -70)
            })
    })

    it("don't read other rendered transforms as the origin", () => {
        cy.visit("?test=animate-stylesheet-transform")
            .get("#rotated")
            .should("have.attr", "data-origin")
            .then((origin: any) => {
                // Not cos(45deg), decomposed from the rotate() matrix
                expect(parseFloat(origin)).to.be.closeTo(1, 0.02)
            })
    })
})
