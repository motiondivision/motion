describe("AnimatePresence: rapid key switching in mode='wait'", () => {
    it("Does not get stuck after rapid key changes on mount", () => {
        /**
         * #3141: Run multiple times since the bug is intermittent,
         * depending on exact timing of React batching and animations.
         */
        for (let attempt = 0; attempt < 5; attempt++) {
            cy.visit("?test=animate-presence-rapid-switch")

            // Wait for all state changes and animations to settle
            cy.wait(3000)

            // The content should show the final "document-" key, not be
            // stuck on a "loading-" key from the rapid mount transitions
            cy.get("#content").should("exist")

            cy.get("#render-key")
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
        }
    })

    it("Does not get stuck after rapid click changes", () => {
        cy.visit("?test=animate-presence-rapid-switch")

        // Wait for initial mount to settle
        cy.wait(3000)

        // Rapidly click to change keys multiple times
        for (let i = 0; i < 5; i++) {
            cy.get("#change").click()
            cy.wait(30)
        }

        // Wait for animations to settle
        cy.wait(3000)

        // Content should show the latest key, not be stuck
        cy.get("#current-key")
            .invoke("text")
            .then((currentKey) => {
                cy.get("#render-key")
                    .invoke("text")
                    .should("eq", "render: " + currentKey)
            })

        // Element should be fully visible
        cy.get("#content").should(($el) => {
            const opacity = parseFloat(
                window.getComputedStyle($el[0]).opacity
            )
            expect(opacity).to.equal(1)
        })
    })
})
