describe("AnimatePresence propagate", () => {
    it("Completes exit when there are no children", () => {
        cy.visit("?test=animate-presence-propagate-empty")
            .get("#toggle")
            .click()
            .get("#section")
            .should("not.exist")
            .get("#exit-complete-count")
            .should("have.text", "1")
    })
})
