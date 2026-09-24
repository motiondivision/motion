const getOpacity = ([$element]: any) =>
    parseFloat(window.getComputedStyle($element).opacity)

describe("Suspense reveal of memoized content", () => {
    it("replays the enter animation when a re-suspended boundary reveals", () => {
        cy.visit("?test=suspense-reveal-memoized")
            .get("#box")
            .should(($element: any) => {
                expect(getOpacity($element)).to.equal(1)
            })
            .get("#suspend")
            .trigger("click", 1, 1, { force: true })
            .get("#fallback")
            .should("exist")
            .get("#fallback", { timeout: 2000 })
            .should("not.exist")
            .wait(500)
            .get("#box")
            .then(($element: any) => {
                expect(getOpacity($element)).to.equal(1)
            })
    })
})
