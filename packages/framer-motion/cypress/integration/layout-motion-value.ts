describe("Layout animation with MotionValue", () => {
    it("Triggers layout animation when MotionValue changes a layout-affecting property", () => {
        cy.visit("?test=layout-motion-value")
            .wait(50)
            .get("#box")
            .should(([$box]: any) => {
                const bbox = $box.getBoundingClientRect()
                expect(bbox.width).to.equal(100)
            })
            .get("#toggle")
            .trigger("click")
            .wait(50)
            .get("#box")
            .should(([$box]: any) => {
                const bbox = $box.getBoundingClientRect()
                // With ease: () => 0.5, layout animation freezes at 50%
                // Width should be 200 (midpoint of 100→300), not 300 (no animation)
                expect(bbox.width).to.equal(200)
            })
    })
})
