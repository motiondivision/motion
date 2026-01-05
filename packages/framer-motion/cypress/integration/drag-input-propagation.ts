/**
 * Tests for issue #1674: Inputs inside draggable elements should not trigger drag
 * https://github.com/motiondivision/motion/issues/1674
 */
describe("Drag Input Propagation", () => {
    it("Should not drag when clicking and dragging on an input inside draggable", () => {
        cy.visit("?test=drag-input-propagation")
            .wait(200)
            .get("[data-testid='draggable']")
            .should(($draggable) => {
                const { left, top } = $draggable[0].getBoundingClientRect()
                // Initial position is at padding: 100
                expect(left).to.equal(100)
                expect(top).to.equal(100)
            })

        // Attempt to drag by clicking on the input
        cy.get("[data-testid='input']")
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10)
            .wait(50)
            .trigger("pointermove", 200, 200, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })

        // Verify the draggable element did NOT move
        cy.get("[data-testid='draggable']").should(($draggable) => {
            const { left, top } = $draggable[0].getBoundingClientRect()
            // Element should still be at its initial position
            expect(left).to.equal(100)
            expect(top).to.equal(100)
        })
    })

    it("Should not drag when clicking and dragging on a textarea inside draggable", () => {
        cy.visit("?test=drag-input-propagation")
            .wait(200)
            .get("[data-testid='draggable']")
            .should(($draggable) => {
                const { left, top } = $draggable[0].getBoundingClientRect()
                expect(left).to.equal(100)
                expect(top).to.equal(100)
            })

        // Attempt to drag by clicking on the textarea
        cy.get("[data-testid='textarea']")
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10)
            .wait(50)
            .trigger("pointermove", 200, 200, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })

        // Verify the draggable element did NOT move
        cy.get("[data-testid='draggable']").should(($draggable) => {
            const { left, top } = $draggable[0].getBoundingClientRect()
            // Element should still be at its initial position
            expect(left).to.equal(100)
            expect(top).to.equal(100)
        })
    })

    it("Should still drag when clicking on the draggable area outside inputs", () => {
        cy.visit("?test=drag-input-propagation")
            .wait(200)
            .get("[data-testid='draggable']")
            .should(($draggable) => {
                const { left, top } = $draggable[0].getBoundingClientRect()
                expect(left).to.equal(100)
                expect(top).to.equal(100)
            })
            // Click on edge of draggable, not on inputs (at coordinates 5,5 which is top-left corner)
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10)
            .wait(50)
            .trigger("pointermove", 200, 200, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable) => {
                const { left, top } = $draggable[0].getBoundingClientRect()
                // Element should have moved - the exact position depends on gesture calculation
                // but should NOT be at original position of 100,100
                expect(left).to.be.greaterThan(200)
                expect(top).to.be.greaterThan(200)
            })
    })
})
