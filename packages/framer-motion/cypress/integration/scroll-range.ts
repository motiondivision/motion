describe("scroll() rangeStart/rangeEnd", () => {
    it("Animation is inactive after rangeEnd", () => {
        cy.visit("?test=scroll-range")
            .wait(100)
            .viewport(100, 400)

        // Scroll to ~50% (well past the 20% rangeEnd)
        cy.scrollTo(0, 800)
            .wait(200)
            .get("#box")
            .then(([$element]: any) => {
                const opacity = parseFloat(
                    getComputedStyle($element).opacity
                )

                if ((window as any).ScrollTimeline) {
                    // With native ScrollTimeline + rangeStart/rangeEnd + fill: auto,
                    // animation is inactive after 20% scroll. Opacity reverts to
                    // CSS default (1).
                    expect(opacity).to.equal(1)
                } else {
                    // Without native ScrollTimeline, rangeStart/rangeEnd have no
                    // effect. Animation maps full scroll to progress, so at 50%
                    // scroll opacity = 0.25 (50% of 0 to 0.5).
                    expect(opacity).to.equal(0.25)
                }
            })
    })
})
