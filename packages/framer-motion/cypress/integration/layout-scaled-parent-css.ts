describe("Layout animation in CSS-scaled parent", () => {
    it("Correctly animates layout when parent has CSS transform: scale()", () => {
        /**
         * #3356: When a parent has CSS transform: scale(2) (as a string,
         * not a motion value) and layoutRoot, children's layout animations
         * should account for the parent scale.
         *
         * Setup:
         *   Parent: layoutRoot, CSS transform: "scale(2)", transformOrigin: "top left"
         *   Child: layout, toggles CSS top from 0 to 50
         *   Transition: duration 10s, ease: () => 0.5 (constant midpoint)
         *
         * In viewport coordinates (parent scale 2):
         *   Start: child at viewport top=0 (CSS top=0 * 2)
         *   End: child at viewport top=100 (CSS top=50 * 2)
         *   Midpoint: child at viewport top=50
         *
         * Bug behavior: the projection system doesn't see the parent's CSS
         * transform string, so treeScale is 1 instead of 2, causing the
         * translateY to be over-applied.
         */
        cy.visit("?test=layout-scaled-parent-css")
            .wait(100)
            .get("#child")
            .should(([$child]: any) => {
                const bbox = $child.getBoundingClientRect()
                // Initial: CSS top=0 in parent space → viewport top=0
                expect(bbox.top).to.equal(0)
                // Width/height doubled by parent scale(2)
                expect(bbox.width).to.equal(100)
                expect(bbox.height).to.equal(100)
            })
            .get("#toggle")
            .trigger("click")
            .wait(200)
            .get("#child")
            .should(([$child]: any) => {
                const bbox = $child.getBoundingClientRect()
                /**
                 * During animation with constant ease 0.5:
                 * Expected: viewport top ≈ 50 (midpoint between 0 and 100)
                 * Bug: viewport top is wrong because CSS scale is invisible
                 * to the projection system
                 */
                expect(bbox.top).to.be.greaterThan(30)
                expect(bbox.top).to.be.lessThan(70)
            })
    })
})
