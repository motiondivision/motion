function getMatrix(element: HTMLElement) {
    const { transform } = element.ownerDocument.defaultView!.getComputedStyle(
        element
    )
    const match = transform.match(/^matrix\((.+)\)$/u)
    return match ? match[1].split(",").map(parseFloat) : [1, 0, 0, 1, 0, 0]
}

describe("Stylesheet transforms", () => {
    it("animate from the stylesheet value, not the default", () => {
        cy.visit("?test=animate-stylesheet-transform")
            .wait(2000)
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
})
