function getTranslateX(element: HTMLElement) {
    const { transform } =
        element.ownerDocument.defaultView!.getComputedStyle(element)
    const match = transform.match(/^matrix\((.+)\)$/u)
    return match ? parseFloat(match[1].split(",")[4]) : 0
}

describe("Stylesheet transforms", () => {
    it("aren't the origin of independent transforms, but are of transform", () => {
        cy.visit("?test=animate-stylesheet-transform")
            .wait(5000)
            .get("#x")
            .then(([element]: any) => {
                // Halfway from 0 to 200, not from the stylesheet's 300
                expect(getTranslateX(element)).to.be.within(85, 115)
            })
            .get("#layout-x")
            .then(([element]: any) => {
                expect(getTranslateX(element)).to.be.within(85, 115)
            })
            .get("#style-x")
            .then(([element]: any) => {
                // Halfway from style.x's 50 to 250
                expect(getTranslateX(element)).to.be.within(135, 165)
            })
            .get("#transform")
            .then(([element]: any) => {
                // Halfway from the stylesheet's 300 to 500
                expect(getTranslateX(element)).to.be.within(385, 415)
            })
    })
})
