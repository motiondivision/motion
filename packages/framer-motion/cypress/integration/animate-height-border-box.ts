describe("height: auto with border-box", () => {
    it("animates to correct target height when box-sizing is border-box with padding", () => {
        cy.visit("?test=animate-height-border-box")
            // Sample at 50% of a 10s linear animation (0 → target).
            // Correct target is 140px (border-box: 100 content + 40 padding),
            // so midpoint ≈ 70px. Bug target was 100px, midpoint ≈ 50px.
            .wait(5000)
            .get("#box")
            .then(($el: any) => {
                const height = parseFloat(
                    getComputedStyle($el[0] as HTMLElement).height
                )
                expect(height).to.be.greaterThan(60)
            })
    })
})
