describe("AnimatePresence exit no-op (#3078)", () => {
    it("Removes modal when child exit targets match current values", () => {
        cy.visit("?test=animate-presence-exit-no-op")
            .wait(200)
            .get("#toggle")
            .click()
            .wait(200)

        // Modal should be visible
        cy.get("#modal").should("exist")

        // Wait for enter animations to complete
        cy.wait(2000)

        // Close the modal via the cancel button
        cy.get("#cancel").click()

        // Modal should be removed promptly. The bug was that
        // value.isAnimating (property access, always truthy) prevented
        // the skip check from working, so exit animations targeting the
        // same values as the current state were never skipped.
        cy.wait(1000)
        cy.get("#modal").should("not.exist")
    })
})
