/**
 * Tests for drag behavior when the draggable element has a rotated parent.
 * Issue: https://github.com/motiondivision/motion/issues/3320
 */
describe("Drag with Rotated Parent", () => {
    it("Drags correctly when parent is rotated 180 degrees", () => {
        cy.visit("?test=drag-rotated-parent&rotate=180")
            .wait(200)
            .get("[data-testid='draggable']")
            .then(($draggable) => {
                const initialRect = $draggable[0].getBoundingClientRect()
                return { initialLeft: initialRect.left, initialTop: initialRect.top }
            })
            .then(({ initialLeft, initialTop }) => {
                cy.get("[data-testid='draggable']")
                    .trigger("pointerdown", 25, 25)
                    .trigger("pointermove", 30, 30) // Start gesture
                    .wait(50)
                    // Drag to the right and down in screen coordinates
                    .trigger("pointermove", 125, 125, { force: true })
                    .wait(50)
                    .trigger("pointerup", { force: true })
                    .should(($draggable) => {
                        const finalRect = $draggable[0].getBoundingClientRect()
                        // When dragging right/down with a 180-degree rotated parent,
                        // the element should move right/down in screen space
                        // (not inverted as the bug causes)
                        expect(finalRect.left).to.be.greaterThan(initialLeft + 50)
                        expect(finalRect.top).to.be.greaterThan(initialTop + 50)
                    })
            })
    })

    it("Drags correctly when parent is rotated 90 degrees", () => {
        cy.visit("?test=drag-rotated-parent&rotate=90")
            .wait(200)
            .get("[data-testid='draggable']")
            .then(($draggable) => {
                const initialRect = $draggable[0].getBoundingClientRect()
                return { initialLeft: initialRect.left, initialTop: initialRect.top }
            })
            .then(({ initialLeft, initialTop }) => {
                cy.get("[data-testid='draggable']")
                    .trigger("pointerdown", 25, 25)
                    .trigger("pointermove", 30, 30) // Start gesture
                    .wait(50)
                    // Drag to the right in screen coordinates
                    .trigger("pointermove", 125, 25, { force: true })
                    .wait(50)
                    .trigger("pointerup", { force: true })
                    .should(($draggable) => {
                        const finalRect = $draggable[0].getBoundingClientRect()
                        // The element should move right in screen space
                        expect(finalRect.left).to.be.greaterThan(initialLeft + 50)
                    })
            })
    })

    it("Drags correctly when parent has no rotation", () => {
        cy.visit("?test=drag-rotated-parent&rotate=0")
            .wait(200)
            .get("[data-testid='draggable']")
            .then(($draggable) => {
                const initialRect = $draggable[0].getBoundingClientRect()
                return { initialLeft: initialRect.left, initialTop: initialRect.top }
            })
            .then(({ initialLeft, initialTop }) => {
                cy.get("[data-testid='draggable']")
                    .trigger("pointerdown", 25, 25)
                    .trigger("pointermove", 30, 30) // Start gesture
                    .wait(50)
                    // Drag to the right and down
                    .trigger("pointermove", 125, 125, { force: true })
                    .wait(50)
                    .trigger("pointerup", { force: true })
                    .should(($draggable) => {
                        const finalRect = $draggable[0].getBoundingClientRect()
                        // Without rotation, element should move in the same direction
                        expect(finalRect.left).to.be.greaterThan(initialLeft + 50)
                        expect(finalRect.top).to.be.greaterThan(initialTop + 50)
                    })
            })
    })
})
