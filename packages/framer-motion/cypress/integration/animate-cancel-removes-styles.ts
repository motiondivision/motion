describe("animation.cancel() removes persisted styles", () => {
    it("Removes persisted inline style when cancel is called after completion", () => {
        cy.visit("?test=animate-cancel-removes-styles")
            .wait(3000)
            .get("#box")
            .then(($el) => {
                const text = $el.text()
                expect(text).to.equal("success")
            })
    })
})
