describe("AnimatePresence reorder", () => {
    it("Correct number of animations trigger", () => {
        cy.visit("?test=animate-presence-reorder")
            .wait(50)
            .get("#move")
            .trigger("click", 10, 10, { force: true })
            .wait(300)
            .get(".item")
            .should((items: any) => {
                expect(items[0].textContent).to.equal("2")
                expect(items[1].textContent).to.equal("")
            })
    })
})
