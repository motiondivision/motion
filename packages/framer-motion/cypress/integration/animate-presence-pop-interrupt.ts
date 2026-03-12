describe("AnimatePresence popLayout interrupt", () => {
    it("removes data-motion-pop-id when exit animation is interrupted", () => {
        cy.visit("?test=animate-presence-pop-interrupt")
            .wait(50)
            .get("#target")
            .should(([$el]: any) => {
                // Initially no pop id
                expect($el.hasAttribute("data-motion-pop-id")).to.be.false
            })
            // Click to start exit (long duration so it won't complete)
            .get("#toggle")
            .click()
            .wait(200)
            .get("#target")
            .should(([$el]: any) => {
                // During exit, element should have pop id
                expect($el.hasAttribute("data-motion-pop-id")).to.be.true
            })
            // Click again to re-enter (interrupt the exit)
            .get("#toggle")
            .click()
            .wait(200)
            .get("#target")
            .should(([$el]: any) => {
                // After re-entry, pop id must be removed
                expect($el.hasAttribute("data-motion-pop-id")).to.be.false
            })
    })
})
