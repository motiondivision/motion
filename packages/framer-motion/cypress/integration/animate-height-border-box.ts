describe("height: auto with border-box", () => {
    it("animates to correct target height when box-sizing is border-box with padding", () => {
        cy.visit("?test=animate-height-border-box")
            // At 5s into a 10s linear animation from 0 to target, height = target/2
            .wait(5000)
            .get("#box")
            .then(($el: any) => {
                const el = $el[0] as HTMLElement
                const computedHeight = parseFloat(
                    getComputedStyle(el).height
                )
                // With border-box, the animation target should be 140px
                // (100px content + 20px top padding + 20px bottom padding)
                // At 50% through linear animation: height ≈ 70px
                // Bug: padding is subtracted, target is 100px, so height ≈ 50px
                expect(computedHeight).to.be.greaterThan(60)
            })
    })
})
