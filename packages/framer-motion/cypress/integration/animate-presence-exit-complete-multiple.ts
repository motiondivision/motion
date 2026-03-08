/**
 * Regression test for issue #3233:
 * AnimatePresence onExitComplete should fire exactly once per exit,
 * even with shared layoutId cycling through multiple AnimatePresence instances.
 */
describe("AnimatePresence onExitComplete", () => {
    it("Only fires once when layoutId child exits and re-enters", () => {
        cy.visit("?test=animate-presence-exit-complete-multiple")
            .wait(2000) // Wait for initial layout animations to settle
            .get("#done-count")
            .should((el: any) => {
                expect(el[0].textContent).to.equal("0")
            })
            .get("#start-1")
            .trigger("click", 10, 10, { force: true })
            .wait(3000) // Wait for all layout animations to complete
            .get("#done-count")
            .should((el: any) => {
                expect(el[0].textContent).to.equal("1")
            })
    })
})
