describe("AnimatePresence key warning", () => {
    it("Does not produce key warnings for conditional children without explicit keys", () => {
        cy.visit("?test=animate-presence-key-warning")
            .wait(200)
            .get("#toggle")
            .click()
            .wait(200)

        cy.get("#drawer").should("exist").should("contain", "Drawer Content")

        // Toggle off then on again to test exit/re-enter cycle
        cy.get("#toggle")
            .click()
            .wait(500)
            .get("#toggle")
            .click()
            .wait(200)

        cy.get("#drawer").should("exist").should("contain", "Drawer Content")
    })
})
