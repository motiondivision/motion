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

    it("preserves width for content-box elements with padding and border", () => {
        cy.visit("?test=animate-presence-pop-subpixel&padding=true")
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

                        // content-box element with padding (20*2) and border (5*2).
                        // Old code used offsetWidth (250) as CSS width, but
                        // content-box width only controls the 200px content area,
                        // so the element would grow by 50px.
                        expect(poppedWidth).to.be.closeTo(
                            initialWidth,
                            0.5
                        )
                    })
            })
    })
})
