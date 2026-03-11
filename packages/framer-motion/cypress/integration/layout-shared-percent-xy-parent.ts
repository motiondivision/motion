describe("Layout animation with percentage x/y parent (#3254)", () => {
    it("layoutId indicator animates to correct position within parent with percentage x/y", () => {
        cy.visit("?test=layout-shared-percent-xy-parent")
            .wait(200)
            .get("#indicator")
            .should("exist")
            // Click tab 2 to trigger layout animation
            .get("#tab-2")
            .trigger("click", { force: true })
            .wait(500)
            .get("#indicator")
            .should(([$indicator]: any) => {
                const bbox = $indicator.getBoundingClientRect()
                // With ease: () => 0.5 and duration: 10s, at any point during
                // the animation (which lasts 10s), progress is always 0.5.
                //
                // Parent is 300px wide with x: "25%" = 75px translate.
                // Tab 0 starts at 75px, tab 2 starts at 275px (75 + 200).
                // At 50% progress: 75 + (275-75)*0.5 = 175px.
                //
                // If the layout animation is broken due to the percentage x/y
                // parent, the indicator snaps to 275 (final position) instead.
                expect(bbox.left).to.be.greaterThan(100)
                expect(bbox.left).to.be.lessThan(250)
            })
    })
})
