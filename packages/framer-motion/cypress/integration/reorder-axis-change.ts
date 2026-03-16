/**
 * Tests for #3022: Reorder.Group stops working if axis changes
 * after window resize (via matchMedia).
 */
describe("Reorder axis change on resize", () => {
    it("Baseline: reorder works without axis change", () => {
        cy.viewport(400, 600)
        cy.visit("?test=reorder-axis-change").wait(200)

        cy.get("[data-testid='current-axis']").should("have.text", "y")

        // Drag Tomato down past Cucumber using element-relative coords
        cy.get("[data-testid='Tomato']")
            .trigger("pointerdown", 40, 25, { force: true })
            .wait(50)
            .trigger("pointermove", 40, 30, { force: true })
            .wait(50)
            .trigger("pointermove", 40, 50, { force: true })
            .wait(50)
            .trigger("pointermove", 40, 80, { force: true })
            .wait(50)
            .trigger("pointermove", 40, 110, { force: true })
            .wait(100)

        cy.get("[data-testid='current-order']").then(($el) => {
            const order = $el.text()
            expect(order).to.not.equal("Tomato,Cucumber,Cheese,Lettuce")
        })

        cy.get("[data-testid='Tomato']").trigger("pointerup", 40, 110, {
            force: true,
        })
    })

    it("Reorders correctly after axis changes via resize", () => {
        // Start wide so axis='x'
        cy.viewport(600, 600)
        cy.visit("?test=reorder-axis-change").wait(200)

        cy.get("[data-testid='current-axis']").should("have.text", "x")

        // Resize to trigger matchMedia → axis='y'
        cy.viewport(400, 600).wait(500)
        cy.get("[data-testid='current-axis']").should("have.text", "y")

        // Drag Tomato down past Cucumber
        cy.get("[data-testid='Tomato']")
            .trigger("pointerdown", 40, 25, { force: true })
            .wait(50)
            .trigger("pointermove", 40, 30, { force: true })
            .wait(50)
            .trigger("pointermove", 40, 50, { force: true })
            .wait(50)
            .trigger("pointermove", 40, 80, { force: true })
            .wait(50)
            .trigger("pointermove", 40, 110, { force: true })
            .wait(100)

        cy.get("[data-testid='current-order']").then(($el) => {
            const order = $el.text()
            expect(order).to.not.equal("Tomato,Cucumber,Cheese,Lettuce")
        })

        cy.get("[data-testid='Tomato']").trigger("pointerup", 40, 110, {
            force: true,
        })
    })
})
