/**
 * Regression test for #2807: a variant that sets a literal `transform` string
 * should not prevent drag from moving the element.
 */
describe("Drag with variant-set transform", () => {
    it("Drags the element even when a variant sets a literal transform string", () => {
        cy.visit("?test=drag-variant-transform")

        // The variant applies `transform: "translate(50px, 60px)"` so the
        // initial bounding rect reflects that translation (padding 100 + 50).
        cy.get("[data-testid='draggable']")
            .wait(200)
            .then(($el: any) => {
                expect(
                    $el[0].getBoundingClientRect().left,
                    "initial transform from variant is applied"
                ).to.equal(150)
            })

        cy.get("[data-testid='handle']")
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10)
            .wait(50)
            .trigger("pointermove", 200, 250, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })

        cy.get("[data-testid='draggable']").should(($el: any) => {
            const { left, top } = $el[0].getBoundingClientRect()
            // Drag moved the pointer by ~195/245 px. The element should have
            // moved by the same amount from its initial position.
            expect(left, "left after drag").to.be.greaterThan(250)
            expect(top, "top after drag").to.be.greaterThan(250)
        })
    })
})
