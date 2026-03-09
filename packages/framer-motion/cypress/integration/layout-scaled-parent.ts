describe("Layout animation in scaled parent", () => {
    it("Correctly animates layout in a CSS-scaled layoutRoot parent", () => {
        /**
         * #3356: When a parent has CSS transform: scale(2) and layoutRoot,
         * children's layout animations should account for the parent scale.
         *
         * Setup:
         *   Parent: layoutRoot, transform: scale(2), transformOrigin: 0 0
         *   Child: layout, toggles CSS top from 0 to 50
         *   Transition: duration 10s, ease: () => 0.5 (constant midpoint)
         *
         * In viewport coordinates (parent scale 2):
         *   Start: child at viewport top=0 (CSS top=0 * 2)
         *   End: child at viewport top=100 (CSS top=50 * 2)
         *   Midpoint: child at viewport top=50
         *
         * Bug behavior: treeScale doesn't include parent CSS scale,
         * so the translateY is over-applied by a factor of 2, causing the
         * child to appear at viewport top=0 instead of top=50.
         */
        cy.visit("?test=layout-scaled-parent")
            .wait(50)
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
            .wait(100)
            .get("#child")
            .should(([$child]: any) => {
                const bbox = $child.getBoundingClientRect()
                /**
                 * During animation with constant ease 0.5:
                 * Expected: viewport top ≈ 50 (midpoint between 0 and 100)
                 * Bug: viewport top ≈ 0 (translation over-applied by parent scale)
                 */
                expect(bbox.top).to.be.greaterThan(20)
                expect(bbox.top).to.be.lessThan(80)
            })
    })
})
