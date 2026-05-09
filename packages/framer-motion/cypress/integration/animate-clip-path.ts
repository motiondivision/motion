describe("animate clipPath (#3101)", () => {
    it("interpolates inset() values smoothly through WAAPI", () => {
        cy.visit("?test=animate-clip-path")
            .wait(200)
            .get("#trigger")
            .trigger("click", { force: true })
            // Mid-animation (linear, 1s duration), expect ~half-way
            .wait(500)
            .get("#box")
            .should(($el) => {
                const el = $el[0] as HTMLElement
                const clipPath = getComputedStyle(el).clipPath
                // Extract numeric values from inset() string
                const matches = clipPath.match(/-?\d+(?:\.\d+)?/g)
                expect(matches, `clipPath was: ${clipPath}`).to.not.be.null
                const numbers = matches!.map(Number)
                // inset() resolves to 4 values [top, right, bottom, left].
                // For our animation top/bottom stay 0, left/right go 0 → 120.
                // At ~50% progress, left and right should be roughly 60 (give a wide tolerance).
                expect(numbers.length).to.be.at.least(2)
                // Find the largest value — it should be a meaningful intermediate
                // value (not 0 and not the final 120).
                const max = Math.max(...numbers)
                expect(max, `expected mid-animation value, got ${clipPath}`)
                    .to.be.greaterThan(20)
                    .and.lessThan(100)
            })
            // Wait for animation to complete
            .wait(700)
            .get("#box")
            .should(($el) => {
                const el = $el[0] as HTMLElement
                const clipPath = getComputedStyle(el).clipPath
                const numbers = (clipPath.match(/-?\d+(?:\.\d+)?/g) || []).map(
                    Number
                )
                const max = Math.max(...numbers)
                expect(max).to.be.closeTo(120, 1)
            })
    })
})
