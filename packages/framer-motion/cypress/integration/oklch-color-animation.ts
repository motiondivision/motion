describe("oklch color animation", () => {
    it("animates to the correct oklch target color", () => {
        cy.visit("?test=oklch-color-animation")
            .wait(200)
            .get("#toggle")
            .click()
            .get("#result")
            .should("not.have.text", "")
            .then(($el) => {
                const data = JSON.parse($el[0].textContent!)

                if (data.supportsOklch) {
                    /**
                     * In browsers that support oklch (Chrome, Firefox, Safari),
                     * the computed style should be the oklch color resolved to
                     * rgb. oklch(0.65 0.18 260) ≈ rgb(71, 150, 210).
                     */
                    const match = data.computed.match(
                        /rgb\((\d+),\s*(\d+),\s*(\d+)\)/
                    )
                    expect(match).to.not.be.null
                    const [, r, g, b] = match!
                    expect(Number(r)).to.be.lessThan(120)
                    expect(Number(g)).to.be.greaterThan(100)
                    expect(Number(b)).to.be.greaterThan(180)
                } else {
                    /**
                     * In browsers that don't support oklch (e.g. Electron),
                     * verify the animation completed without crashing.
                     * The unit tests for supportsBrowserAnimation are the
                     * primary regression gate for this fix.
                     */
                    expect(data.computed).to.match(/^rgb/)
                }
            })
    })
})
