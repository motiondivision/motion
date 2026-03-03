describe("useAnimate WAAPI interruption", () => {
    it("should not jump to origin when interrupting transform animation", () => {
        cy.visit("?test=waapi-interrupt-transform")
            .wait(1000)
            .get("#result")
            .should(($el) => {
                const minOffset = parseInt($el.text())
                // After animation starts (tracking begins at 100ms),
                // the element should never jump back near origin.
                // At 100ms with linear easing over 1s to 200px,
                // the element is at ~20px offset. If there's a jump
                // to origin, minOffset would be ~0.
                expect(minOffset).to.be.greaterThan(10)
            })
    })
})
