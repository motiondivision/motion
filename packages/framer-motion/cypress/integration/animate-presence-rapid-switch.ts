describe("AnimatePresence: rapid key switching in mode='wait'", () => {
    it("Does not get stuck after rapid key changes on mount", () => {
        cy.visit("?test=animate-presence-rapid-switch")

        // The content should show the final "document-" key, not be
        // stuck on a "loading-" key from the rapid mount transitions.
        // Uses Cypress retry (up to 10s) instead of a fixed wait.
        cy.get("#render-key", { timeout: 10000 })
            .invoke("text")
            .should("match", /^render: document-/)

        // The displayed key should match the current state
        cy.get("#current-key")
            .invoke("text")
            .then((currentKey) => {
                cy.get("#render-key")
                    .invoke("text")
                    .should("eq", "render: " + currentKey)
            })
    })

    it("Does not get stuck after rapid click changes", () => {
        cy.visit("?test=animate-presence-rapid-switch")

        // Wait for initial mount animations to settle
        cy.get("#render-key", { timeout: 10000 })
            .invoke("text")
            .should("match", /^render: document-/)

        // Rapidly click to change keys multiple times
        for (let i = 0; i < 5; i++) {
            cy.get("#change").click()
        }

        // Content should show the latest key, not be stuck.
        // Grab the current key first, then wait for render to match.
        cy.get("#current-key")
            .invoke("text")
            .then((currentKey) => {
                cy.get("#render-key", { timeout: 10000 })
                    .invoke("text")
                    .should("eq", "render: " + currentKey)
            })

        // Element should be fully visible
        cy.get("#content", { timeout: 10000 }).should(($el) => {
            const opacity = parseFloat(
                window.getComputedStyle($el[0]).opacity
            )
            expect(opacity).to.equal(1)
        })
    })
})
