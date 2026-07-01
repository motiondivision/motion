/**
 * Reproduction for #3746 — AnimatePresence enter/exit tracking inside
 * React.StrictMode.
 *
 * A persistent key (present in both datasets) must not be re-mounted when
 * switching datasets. If it is, it replays its enter animation (width from 0)
 * and its mount count increases.
 */
describe("AnimatePresence dataset switch in StrictMode", () => {
    it("Does not re-mount persistent children when switching datasets", () => {
        cy.visit("?test=strict-mode-animate-presence-switch")
            .wait(600)
            // The persistent bar has finished entering.
            .get("#bar-persist")
            .then(($el: any) => {
                expect($el[0].getBoundingClientRect().width).to.be.greaterThan(
                    150
                )
            })
            // First switch A -> B
            .get("#switch")
            .trigger("click", 5, 5, { force: true })
            .wait(600)
            // Second switch B -> A — this is where the bug appears.
            .get("#switch")
            .trigger("click", 5, 5, { force: true })
            .wait(100)
            // Right after the second switch, "persist" should still be at its
            // full width (only translating), not collapsed back to ~0.
            .get("#bar-persist")
            .then(($el: any) => {
                expect($el[0].getBoundingClientRect().width).to.be.greaterThan(
                    150
                )
            })
            .wait(600)
            // The persistent bar must have mounted only the StrictMode double
            // mount on first render, never re-mounted on a switch.
            .window()
            .then((win: any) => {
                expect(win.mountCounts.persist).to.be.lessThan(3)
            })
    })
})
