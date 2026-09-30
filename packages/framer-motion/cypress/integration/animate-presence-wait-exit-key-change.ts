describe("AnimatePresence mode=wait: key changes as the exit completes", () => {
    it("renders the latest child", () => {
        cy.visit("?test=animate-presence-wait-exit-key-change")
            .wait(100)
            .get("#next")
            .click()
            .get("#state")
            .should("have.text", "2")
            .get(".child", { timeout: 2000 })
            .should(($children: any) => {
                expect($children.length).to.equal(1)
                expect($children[0].id).to.equal("child-2")
                expect(getComputedStyle($children[0]).opacity).to.equal("1")
            })
    })
})
