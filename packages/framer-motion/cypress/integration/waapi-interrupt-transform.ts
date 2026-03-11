describe("useAnimate WAAPI interruption", () => {
    it("should not jump to origin when interrupting transform animation", () => {
        cy.visit("?test=waapi-interrupt-transform")
            .wait(2500)
            .get("#result")
            .should(($el) => {
                const minOffset = parseInt($el.text())
                // After animation starts (tracking begins at 500ms),
                // the element should never jump back near origin.
                // With 2s linear to 200px, even with 200ms resolver
                // delay, at 500ms the element is at ~30px.
                // A jump to origin would make minOffset ~0.
                expect(minOffset).to.be.greaterThan(15)
            })
    })
})
