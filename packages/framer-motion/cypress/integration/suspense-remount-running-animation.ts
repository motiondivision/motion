const getOpacity = ([$element]: any) =>
    parseFloat(window.getComputedStyle($element).opacity)

describe("Remount during an accelerated animation", () => {
    it("replays opacity to its target", () => {
        cy.visit("?test=suspense-remount-running-animation")
            .get("#remounted")
            .should("exist")
            .wait(500)
            .get("#box")
            .then(($element: any) => {
                expect(getOpacity($element)).to.equal(1)
            })
    })
})
