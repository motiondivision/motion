describe("useScroll target accounts for CSS translate (#2914)", () => {
    it("scroll progress reflects CSS translateY on target", () => {
        cy.visit("?test=scroll-target-translate")
            .wait(200)
            .scrollTo(0, 1000, { duration: 0 })
            .wait(500)
            .get("#indicator")
            .then(([$el]: any) => {
                const opacity = parseFloat(getComputedStyle($el).opacity)
                /**
                 * Target layout position: 1000px (spacer height).
                 * Target has transform: translateY(500px), visual position = 1500px.
                 * With offset ["start end", "end start"] and 660px viewport:
                 *
                 * With fix (accounts for translate):
                 *   progress at scroll 1000 ≈ 0.19, opacity ≈ 0.81
                 *
                 * Without fix (ignores translate):
                 *   progress at scroll 1000 ≈ 0.77, opacity ≈ 0.23
                 *
                 * Assert opacity > 0.5 to verify translate is accounted for.
                 */
                expect(opacity).to.be.greaterThan(0.5)
            })
    })
})
