describe("LazyMotion with fast state changes", () => {
    it("animates when state changes before features load", () => {
        cy.visit("?test=lazy-motion-fast-state")
            .wait(300) // Wait for features to load and animation to complete
            .get("#box")
            .should(([$element]: any) => {
                // Verify the animation completed
                expect($element.dataset.animationComplete).to.equal("true")
                // Verify the element is visible (opacity: 1)
                expect(getComputedStyle($element).opacity).to.equal("1")
            })
    })
})
