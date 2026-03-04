describe("AnimatePresence popLayout subpixel precision", () => {
    it("preserves sub-pixel width when popping layout", () => {
        cy.visit("?test=animate-presence-pop-subpixel")
            .wait(50)
            .get("#child")
            .then(($child) => {
                const initialWidth = $child[0].getBoundingClientRect().width

                cy.get("#toggle")
                    .click()
                    .wait(50)
                    .get("#child")
                    .should(($el) => {
                        const poppedWidth =
                            $el[0].getBoundingClientRect().width

                        // After pop, width must match the original sub-pixel
                        // value within 0.1px — not rounded to an integer.
                        expect(poppedWidth).to.be.closeTo(
                            initialWidth,
                            0.1
                        )
                    })
            })
    })
})
