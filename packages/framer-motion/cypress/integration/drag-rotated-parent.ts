describe("Drag with rotated parent", () => {
    it("Element follows cursor when parent is rotated 180deg", () => {
        cy.visit("?test=drag-rotated-parent")
            .wait(200)
            .get("[data-testid='draggable']")
            .wait(100)
            .trigger("pointerdown", 50, 50)
            .trigger("pointermove", 55, 55) // Past threshold
            .wait(50)
            .trigger("pointermove", 150, 50, { force: true }) // Move right
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($el: any) => {
                const { left } = $el[0].getBoundingClientRect()
                // Element starts at left=300 (child at top-left of 400x400
                // container rotated 180deg around center)
                // Cursor moved right, so element should also move right
                // Without fix (bug): left ≈ 205 (moves opposite to cursor)
                // With fix: left ≈ 405 (follows cursor)
                expect(left).to.be.greaterThan(350)
            })
    })
})
