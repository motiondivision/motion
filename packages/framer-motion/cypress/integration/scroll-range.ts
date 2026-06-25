/**
 * #3001: scroll() rangeStart/rangeEnd should deactivate the animation outside
 * the range, restoring the element's base CSS opacity (0.1) past rangeEnd.
 *
 * Page height = 5 * 100vh, so with a 1000px viewport scrollLength = 4000px.
 * rangeEnd "20%" = 800px.
 */
describe("scroll() rangeStart/rangeEnd (#3001)", () => {
    it("Animates within the range and deactivates past rangeEnd", () => {
        cy.viewport(1000, 1000)
        cy.visit("?test=scroll-range").wait(200)

        // 600px scroll = 15% (three quarters through the 0%–20% range) → ~0.75,
        // clearly distinct from the 0.1 base.
        cy.scrollTo(0, 600)
            .wait(200)
            .get("#box")
            .should(([$el]: any) => {
                const opacity = parseFloat(getComputedStyle($el).opacity)
                expect(opacity).to.be.within(0.65, 0.85)
            })

        // 2000px scroll = 50%, past rangeEnd (20%) → animation inactive, so the
        // base CSS opacity (0.1) applies again.
        cy.scrollTo(0, 2000)
            .wait(200)
            .get("#box")
            .should(([$el]: any) => {
                const opacity = parseFloat(getComputedStyle($el).opacity)
                expect(opacity).to.be.closeTo(0.1, 0.03)
            })

        // Scrolling back into the range reactivates the animation.
        cy.scrollTo(0, 600)
            .wait(200)
            .get("#box")
            .should(([$el]: any) => {
                const opacity = parseFloat(getComputedStyle($el).opacity)
                expect(opacity).to.be.within(0.65, 0.85)
            })
    })
})
