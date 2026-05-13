describe("issue 2826: animate(motionValue) with ease: 'linear' renders linearly", () => {
    it("opacity progresses linearly across the duration", () => {
        const tolerance = 0.1

        cy.visit("?test=issue-2826-linear-motion-value")
            .wait(2500)
            .get("#box")
            .then(([$element]: any) => {
                const opacity = parseFloat(
                    getComputedStyle($element).opacity
                )
                // 25% through 10s should be ~0.25
                expect(opacity).to.be.greaterThan(0.25 - tolerance)
                expect(opacity).to.be.lessThan(0.25 + tolerance)
            })
            .wait(2500)
            .then(([$element]: any) => {
                const opacity = parseFloat(
                    getComputedStyle($element).opacity
                )
                // 50% through 10s should be ~0.5
                expect(opacity).to.be.greaterThan(0.5 - tolerance)
                expect(opacity).to.be.lessThan(0.5 + tolerance)
            })
            .wait(2500)
            .then(([$element]: any) => {
                const opacity = parseFloat(
                    getComputedStyle($element).opacity
                )
                // 75% through 10s should be ~0.75
                expect(opacity).to.be.greaterThan(0.75 - tolerance)
                expect(opacity).to.be.lessThan(0.75 + tolerance)
            })
    })
})
