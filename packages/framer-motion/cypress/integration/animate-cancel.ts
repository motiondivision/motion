describe("animation.cancel()", () => {
    it("Doesn't throw error on unmount", () => {
        cy.visit("?test=animate-cancel")
            .get(".box")
            .wait(100)
            .should("not.contain", "error")
    })
})
