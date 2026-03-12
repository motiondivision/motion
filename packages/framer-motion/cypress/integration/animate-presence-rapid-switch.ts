describe("AnimatePresence: rapid key switching in mode='wait'", () => {
    it("Does not get stuck after rapid key changes on mount", () => {
        cy.visit("?test=animate-presence-rapid-switch")

        // The component rapidly cycles keys on mount. AnimatePresence
        // must eventually settle on a "document-" key (not stuck on
        // "loading-"). Use should("contain.text") because Cypress 4.x
        // doesn't re-query replaced DOM elements in invoke() chains.
        cy.get("#render-key", { timeout: 15000 }).should(
            "contain.text",
            "document-"
        )
    })
})
