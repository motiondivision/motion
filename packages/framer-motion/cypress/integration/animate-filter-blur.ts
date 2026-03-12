describe("animate() filter blur (#3102)", () => {
    it("animates filter blur values correctly including re-animation", () => {
        cy.visit("?test=animate-filter-blur")

        // First animation should complete
        cy.get("#done").should("contain", "true")

        // Re-animation should also complete
        cy.get("#reanimated").should("contain", "true")

        // The box should have the correct final filter value
        cy.get("#box").should(($el) => {
            const el = $el[0] as HTMLElement
            const filter = getComputedStyle(el).filter
            // After blur(0px) animation, filter should be "none" or "blur(0px)"
            expect(
                filter === "none" || filter === "blur(0px)"
            ).to.be.true
        })
    })
})
