describe("AnimatePresence", () => {
    it("Ensures all elements are removed", () => {
        cy.visit("?test=animate-presence-layout")
            .wait(50)
            .get("#inner")
            .trigger("click", 1, 1, { force: true })
            .wait(100)
            .get("#outer")
            .trigger("click", 1, 1, { force: true })
            .wait(700)
            .get("#box")
            .should("not.exist")
    })
})
