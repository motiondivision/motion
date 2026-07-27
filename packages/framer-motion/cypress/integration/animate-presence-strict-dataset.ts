/**
 * Reproduction for #3746 — a key present in both datasets must not be treated
 * as freshly entering when the dataset is switched.
 *
 * The reported symptom is that on the *second* switch the persisting bar
 * "disappears and reappears, and its width animates from 0". We sample its
 * width every frame for the whole switch, so a collapse can't be missed
 * between assertions.
 */
describe("AnimatePresence dataset switch", () => {
    it("Never replays the enter animation for a persisting key", () => {
        cy.visit("?test=animate-presence-strict-dataset")
            .wait(700)
            // First switch A -> B, let it settle completely.
            .get("#switch")
            .trigger("click", 5, 5, { force: true })
            .wait(700)
            // Start sampling fresh, then perform the second switch.
            .window()
            .then((win: any) => win.presenceDataset.resetWidths())
            .get("#switch")
            .trigger("click", 5, 5, { force: true })
            .wait(700)
            .window()
            .then((win: any) => {
                // The bar goes from 240 -> 200. It must never dip towards 0.
                expect(win.presenceDataset.minWidth()).to.be.greaterThan(150)
                // And it must never have re-mounted. StrictMode double-invokes
                // effects on mount, so a bar that mounts once reports 2.
                expect(win.presenceDataset.mounts.persist).to.equal(2)
            })
    })
})
