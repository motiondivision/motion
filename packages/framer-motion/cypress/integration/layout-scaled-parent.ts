/**
 * Tests for issue #3356: Layout animations misaligned in scaled parent containers.
 *
 * When a parent element has a CSS scale transform applied (via layoutRoot + scale prop),
 * child elements using layout animations should calculate correct initial positions,
 * not start from wrong (scaled) coordinates.
 */
describe("Layout animation: Scaled parent container", () => {
    it("Child starts animation from correct visual position when parent has scale + layoutRoot", () => {
        cy.visit("?test=layout-scaled-parent")
            .wait(100)

        // Record child's initial visual position
        cy.get("#child").then(([$child]: any) => {
            const initialBbox = $child.getBoundingClientRect()

            // Trigger layout change (child moves from flex-start to flex-end)
            cy.get("#toggle").click()

            // Immediately after click, child should still appear at (or very near)
            // its original visual position — the animation starts from there.
            // With a 10s transition, the child should barely have moved.
            cy.get("#child").should(([$child]: any) => {
                const bbox = $child.getBoundingClientRect()
                // Allow 5px tolerance for the start of animation
                expect(Math.abs(bbox.left - initialBbox.left)).to.be.lessThan(5)
                expect(Math.abs(bbox.top - initialBbox.top)).to.be.lessThan(5)
            })
        })
    })
})
