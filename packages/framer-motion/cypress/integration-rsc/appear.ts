describe("appear", () => {
    it("Renders CSS enter animations from a server component", () => {
        // The server's HTML carries the animation
        cy.request("/appear")
            .its("body")
            .should("include", "m-opacity 2s linear 0s both")
            .and("include", "@keyframes m-opacity")

        cy.visit("/appear").get("#appear").should("exist")
    })
})
