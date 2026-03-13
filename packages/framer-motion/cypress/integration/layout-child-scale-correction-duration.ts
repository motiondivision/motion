describe("Layout animation: child scale correction with duration (#3028)", () => {
    it("Child element size never overshoots during parent layout animation", () => {
        cy.visit("?test=layout-child-scale-correction-duration")
            .wait(50)
            .get("#parent")
            .trigger("click")
            // Wait for full animation to complete (parent: 1s)
            .wait(1200)
            .get("#tracker")
            .then(([$tracker]: any) => {
                const minW = parseFloat($tracker.dataset.minW)
                const maxW = parseFloat($tracker.dataset.maxW)
                const minH = parseFloat($tracker.dataset.minH)
                const maxH = parseFloat($tracker.dataset.maxH)

                // Child goes from 40 to 60. With some tolerance for
                // sub-pixel rendering, min should be >=38 and max <=62.
                // With the bouncing bug, these values deviate wildly.
                expect(minW).to.be.greaterThan(38)
                expect(maxW).to.be.lessThan(62)
                expect(minH).to.be.greaterThan(38)
                expect(maxH).to.be.lessThan(62)
            })
    })
})
