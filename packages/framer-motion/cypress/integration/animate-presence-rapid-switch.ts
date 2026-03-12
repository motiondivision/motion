describe("AnimatePresence: rapid key switching in mode='wait'", () => {
    it("Does not get stuck after rapid key changes on mount", () => {
        cy.visit("?test=animate-presence-rapid-switch")

        // Wait for AnimatePresence to settle through all rapid key
        // transitions. Use contain.text (not invoke().should()) because
        // Cypress 4.x doesn't re-query the element in invoke() chains.
        cy.get("#render-key", { timeout: 10000 }).should(
            "contain.text",
            "document-"
        )

        // The displayed key should match the current state
        cy.get("#current-key")
            .invoke("text")
            .then((currentKey) => {
                cy.get("#render-key").should(
                    "have.text",
                    "render: " + currentKey
                )
            })
    })

    it("Does not get stuck after rapid click changes", () => {
        cy.visit("?test=animate-presence-rapid-switch")

        // Wait for initial mount animations to settle
        cy.get("#render-key", { timeout: 10000 }).should(
            "contain.text",
            "document-"
        )

        // Rapidly click to change keys multiple times
        for (let i = 0; i < 5; i++) {
            cy.get("#change").click()
        }

        // Capture the final expected key, then wait for render to catch
        // up through all queued AnimatePresence transitions.
        cy.get("#current-key")
            .invoke("text")
            .then((currentKey) => {
                cy.get("#render-key", { timeout: 15000 }).should(
                    "have.text",
                    "render: " + currentKey
                )
            })

        // Element should be fully visible (opacity animation complete)
        cy.get("#content").should(($el) => {
            const opacity = parseFloat(
                window.getComputedStyle($el[0]).opacity
            )
            expect(opacity).to.equal(1)
        })
    })
})
