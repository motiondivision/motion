describe("Time-defined spring with inherited velocity", () => {
    it("Doesn't wildly oscillate when velocity is inherited from interrupted animation", () => {
        /**
         * Reproduces the Framer bug:
         * 1. Appear animation sets velocity on motionValue when stopped
         * 2. Hover animation reads velocity and passes to time-defined spring
         * 3. findSpring() computes wrong parameters → wild oscillation
         *
         * Opacity starts at 0.5 with +5/s velocity (simulating interrupted
         * appear). Hover targets 0.49. Without fix, opacity shoots up to
         * ~0.58+ before settling. With fix, it stays near 0.5.
         */
        cy.visit("?test=layout-appear-spring-bounce")
            .wait(1500)
            .get("#tracker")
            .should(([$tracker]: any) => {
                const maxOpacity = Number($tracker.dataset.maxOpacity)

                // Opacity starts at 0.5, targets 0.49 (tiny delta of 0.01)
                // A well-behaved spring should barely overshoot above 0.5
                // Bug: velocity causes overshoot to ~0.58+
                // Fixed: maxOpacity stays near 0.5
                expect(maxOpacity).to.be.lessThan(
                    0.55,
                    `Opacity overshot to ${maxOpacity} (start: 0.5, target: 0.49). ` +
                        `Time-defined spring should ignore inherited velocity.`
                )
            })
    })
})
