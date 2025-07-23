describe("use client", () => {
    it("Correctly renders components", () => {
        cy.visit("/")
            .wait(100)
            .get("#m-test")
            .should("exist")
            .get("#motion-client")
            .should("exist")
            .get("#motion-client-with-children")
            .should("exist")
            .get("#motion-render-children")
            .should("exist")
    })
})
