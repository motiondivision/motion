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

    it("Does not get stuck after rapid click changes", () => {
        cy.visit("?test=animate-presence-rapid-switch")

        // Wait for mount to settle
        cy.get("#render-key", { timeout: 15000 }).should(
            "contain.text",
            "document-"
        )

        // Rapidly click to change keys multiple times
        for (let i = 0; i < 5; i++) {
            cy.get("#change").click()
        }

        // AnimatePresence must settle back to a "document-" key at
        // full opacity — not stuck on a "loading-" key or mid-animation.
        cy.get("#render-key", { timeout: 15000 }).should(
            "contain.text",
            "document-"
        )
        cy.get("#content").should(($el) => {
            const opacity = parseFloat(
                window.getComputedStyle($el[0]).opacity
            )
            expect(opacity).to.equal(1)
        })
    })
})
