describe("useScroll with target ref hydrated after useScroll's own effects", () => {
    it("Tracks the target element, not the whole window", () => {
        // Target sits 1000px below the top in a 2000px-tall page (500px
        // viewport). At scrollY=400 the target is still off-screen, so
        // progress must be ~0. If useScroll falls back to whole-window
        // tracking, progress is 400/1500 ≈ 0.267.
        cy.visit("?test=use-scroll-target-late-ref").viewport(100, 500)

        // Wait for the nested ReactDOM root to actually mount instead of a
        // blind fixed wait — scrolling before the Repro has rendered and
        // useScroll has resolved the late ref is the main flake source.
        cy.get("#target").should("exist")
        cy.get("#progress").should("exist")

        cy.scrollTo(0, 400)

        // Use .should (not a single-shot .then) so the assertion retries:
        // the correct value (0) and the buggy window-tracking value (~0.267)
        // are both steady-state, so retrying cannot mask the bug — it only
        // absorbs the transient where useScroll briefly reports window
        // progress before re-resolving the late-hydrated ref.
        cy.get("#progress").should(([$el]: any) => {
            expect(parseFloat($el.innerText)).to.be.lessThan(0.05)
        })
    })
})
