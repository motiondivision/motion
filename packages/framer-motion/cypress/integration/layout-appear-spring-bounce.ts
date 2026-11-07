describe("Time-defined spring with inherited velocity", () => {
    it("Carries inherited velocity, then settles at its target", () => {
        /**
         * The Framer scenario:
         * 1. Appear animation sets velocity on motionValue when stopped
         * 2. Hover animation reads velocity and passes to time-defined spring
         *
         * Opacity starts at 0.5 with +5/s velocity (simulating interrupted
         * appear). Hover targets 0.49 with { duration: 0.4, bounce: 0.2 }.
         * With that velocity as its initial condition, the spring carries
         * on to ~0.59 before settling at 0.49. Ignoring velocity, it never
         * rises above 0.5. Velocity that leaked into the resolved spring
         * physics would overshoot further, or never settle.
         */
        cy.visit("?test=layout-appear-spring-bounce")
            .wait(1500)
            .get("#tracker")
            .should(([$tracker]: any) => {
                const maxOpacity = Number($tracker.dataset.maxOpacity)
                const opacity = Number($tracker.dataset.opacity)

                expect(maxOpacity).to.be.greaterThan(
                    0.55,
                    `Opacity peaked at ${maxOpacity}: inherited velocity was dropped`
                )
                expect(maxOpacity).to.be.lessThan(
                    0.62,
                    `Opacity overshot to ${maxOpacity} (start: 0.5, target: 0.49)`
                )
                expect(opacity).to.equal(0.49)
            })
    })
})
