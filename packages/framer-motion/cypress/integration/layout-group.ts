/**
 * Mid-animation checks retry via .get().should() instead of measuring once
 * after a fixed wait, which slow CI can overshoot. The page's 1s layout
 * tween leaves a wide window to observe the element in flight.
 */
const buttonTop = ($button: JQuery<HTMLElement>) =>
    Math.round($button[0].getBoundingClientRect().top)

describe(`LayoutGroup inherit="id"`, () => {
    it("relative children should not instantly jump to new layout", () => {
        cy.viewport(500, 500).visit("?test=layout-group").wait(250)

        // Measure initial position
        let initialTop: number
        cy.get("#button").then(($button) => {
            initialTop = buttonTop($button)
        })

        // Click expander
        cy.get("#expander").click()

        // Should pass through positions other than the original or final
        let midTop: number
        cy.get("#button").should(($button) => {
            midTop = buttonTop($button)
            expect(midTop).to.not.equal(104)
            expect(midTop).to.not.equal(initialTop)
        })

        // Then finish the animation in the final position
        cy.get("#button").should(($button) => {
            const finalTop = buttonTop($button)
            expect(finalTop).to.equal(104)
            expect(finalTop).to.not.equal(initialTop)
            expect(finalTop).to.not.equal(midTop)
        })
    })

    it("relative children should not instantly jump to new layout, after performing their own layout animation", () => {
        cy.viewport(500, 500).visit("?test=layout-group").wait(250)

        // Click button first and let it finish its own layout animation
        cy.get("#button").click()
        let initialTop: number
        cy.get("#button").should(($button) => {
            initialTop = buttonTop($button)
            expect(initialTop).to.equal(129)
        })

        // Click expander
        cy.get("#expander").click()

        // Don't be in final or original position
        let midTop: number
        cy.get("#button").should(($button) => {
            midTop = buttonTop($button)
            expect(midTop).to.not.equal(204)
            expect(midTop).to.not.equal(initialTop)
        })

        cy.get("#button").should(($button) => {
            const finalTop = buttonTop($button)
            expect(finalTop).to.equal(204)
            expect(finalTop).to.not.equal(initialTop)
            expect(finalTop).to.not.equal(midTop)
        })
    })

    it("should return to original state when expander is clicked twice with delay", () => {
        cy.viewport(500, 500).visit("?test=layout-group").wait(250)

        // Measure initial position
        let initialTop: number
        cy.get("#button").then(($button) => {
            initialTop = buttonTop($button)
        })

        // Click expander
        cy.get("#expander").click()

        // Should not be in original or final position
        cy.get("#button").should(($button) => {
            const top = buttonTop($button)
            expect(top).to.not.equal(104)
            expect(top).to.not.equal(initialTop)
        })

        // Wait 50ms, then click expander again mid-animation
        cy.wait(50).get("#expander").click()

        // Should animate back to original state
        cy.get("#button").should(($button) => {
            expect(buttonTop($button)).to.equal(initialTop)
        })
    })
})
