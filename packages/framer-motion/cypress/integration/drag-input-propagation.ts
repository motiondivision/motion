/**
 * Tests for drag behavior with interactive elements inside draggable elements.
 *
 * Form controls where text selection or direct interaction is expected
 * (input, textarea, select, contenteditable) should NOT trigger drag.
 *
 * Buttons and links SHOULD allow drag since they don't have click-and-move
 * actions of their own.
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

    it("Should drag when clicking and dragging on a button inside draggable", () => {
        cy.visit("?test=drag-input-propagation")
            .wait(200)
            .get("[data-testid='draggable']")
            .should(($draggable) => {
                const { left, top } = $draggable[0].getBoundingClientRect()
                expect(left).to.equal(100)
                expect(top).to.equal(100)
            })

        // Drag by clicking on the button - buttons don't have click-and-move actions
        cy.get("[data-testid='button']")
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10)
            .wait(50)
            .trigger("pointermove", 200, 200, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })

        // Verify the draggable element DID move
        cy.get("[data-testid='draggable']").should(($draggable) => {
            const { left, top } = $draggable[0].getBoundingClientRect()
            // Element should have moved
            expect(left).to.be.greaterThan(200)
            expect(top).to.be.greaterThan(200)
        })
    })

    it("Should drag when clicking and dragging on a link inside draggable", () => {
        cy.visit("?test=drag-input-propagation")
            .wait(200)
            .get("[data-testid='draggable']")
            .should(($draggable) => {
                const { left, top } = $draggable[0].getBoundingClientRect()
                expect(left).to.equal(100)
                expect(top).to.equal(100)
            })

        // Drag by clicking on the link - links don't have click-and-move actions
        cy.get("[data-testid='link']")
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10)
            .wait(50)
            .trigger("pointermove", 200, 200, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })

        // Verify the draggable element DID move
        cy.get("[data-testid='draggable']").should(($draggable) => {
            const { left, top } = $draggable[0].getBoundingClientRect()
            // Element should have moved
            expect(left).to.be.greaterThan(200)
            expect(top).to.be.greaterThan(200)
        })
    })

    it("Should not drag when clicking and dragging on a select inside draggable", () => {
        cy.visit("?test=drag-input-propagation")
            .wait(200)
            .get("[data-testid='draggable']")
            .should(($draggable) => {
                const { left, top } = $draggable[0].getBoundingClientRect()
                expect(left).to.equal(100)
                expect(top).to.equal(100)
            })

        // Attempt to drag by clicking on the select
        cy.get("[data-testid='select']")
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10)
            .wait(50)
            .trigger("pointermove", 200, 200, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })

        // Verify the draggable element did NOT move
        cy.get("[data-testid='draggable']").should(($draggable) => {
            const { left, top } = $draggable[0].getBoundingClientRect()
            expect(left).to.equal(100)
            expect(top).to.equal(100)
        })
    })

    it("Should not drag when clicking and dragging on a checkbox inside a label inside draggable", () => {
        cy.visit("?test=drag-input-propagation")
            .wait(200)
            .get("[data-testid='draggable']")
            .should(($draggable) => {
                const { left, top } = $draggable[0].getBoundingClientRect()
                expect(left).to.equal(100)
                expect(top).to.equal(100)
            })

        // Attempt to drag by clicking on the checkbox (nested inside label)
        cy.get("[data-testid='checkbox']")
            .trigger("pointerdown", 2, 2)
            .trigger("pointermove", 5, 5)
            .wait(50)
            .trigger("pointermove", 200, 200, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })

        // Verify the draggable element did NOT move
        cy.get("[data-testid='draggable']").should(($draggable) => {
            const { left, top } = $draggable[0].getBoundingClientRect()
            expect(left).to.equal(100)
            expect(top).to.equal(100)
        })
    })

    it("Should not drag when clicking and dragging on a contenteditable element inside draggable", () => {
        cy.visit("?test=drag-input-propagation")
            .wait(200)
            .get("[data-testid='draggable']")
            .should(($draggable) => {
                const { left, top } = $draggable[0].getBoundingClientRect()
                expect(left).to.equal(100)
                expect(top).to.equal(100)
            })

        // Attempt to drag by clicking on the contenteditable element
        cy.get("[data-testid='contenteditable']")
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10)
            .wait(50)
            .trigger("pointermove", 200, 200, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })

        // Verify the draggable element did NOT move
        cy.get("[data-testid='draggable']").should(($draggable) => {
            const { left, top } = $draggable[0].getBoundingClientRect()
            expect(left).to.equal(100)
            expect(top).to.equal(100)
        })
    })

    it("Should still drag when clicking on the draggable area outside interactive elements", () => {
        cy.visit("?test=drag-input-propagation")
            .wait(200)
            .get("[data-testid='draggable']")
            .should(($draggable) => {
                const { left, top } = $draggable[0].getBoundingClientRect()
                expect(left).to.equal(100)
                expect(top).to.equal(100)
            })
            // Click on edge of draggable, not on interactive elements (at coordinates 5,5 which is top-left corner)
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
