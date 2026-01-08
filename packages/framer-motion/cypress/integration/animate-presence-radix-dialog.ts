describe("AnimatePresence with Radix UI Dialog", () => {
    it("Exit animations work correctly with Radix Dialog asChild", () => {
        cy.visit("?test=animate-presence-radix-dialog")
            .wait(100)
            // Open the dialog
            .get("#trigger")
            .click()
            .wait(500)
            // Verify dialog is open
            .get("#dialog")
            .should("exist")
            .get("#overlay")
            .should("exist")
            // Close the dialog
            .get("#close")
            .click()
            // Wait for exit animation to complete
            .wait(600)
            // Verify exit animation completed (onExitComplete was called)
            .get("#exit-complete")
            .should("have.attr", "data-value", "true")
            // Verify the dialog elements are removed from DOM after exit
            .get("#dialog")
            .should("not.exist")
            .get("#overlay")
            .should("not.exist")
    })

    it("Exit animation actually runs (not immediately removed)", () => {
        cy.visit("?test=animate-presence-radix-dialog")
            .wait(100)
            // Open the dialog
            .get("#trigger")
            .click()
            .wait(500)
            // Verify dialog is open
            .get("#overlay")
            .should("exist")
            // Close the dialog
            .get("#close")
            .click()
            // Check immediately - overlay should still exist during exit animation
            .get("#overlay")
            .should("exist")
            // Wait a small amount for animation to start but not complete
            .wait(100)
            // Overlay should still be animating out
            .get("#overlay")
            .should("exist")
            // Now wait for full animation
            .wait(400)
            // Now it should be gone
            .get("#overlay")
            .should("not.exist")
    })
})
