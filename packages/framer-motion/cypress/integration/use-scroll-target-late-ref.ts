describe("useScroll with target ref hydrated after useScroll's own effects", () => {
    it("Tracks the target element, not the whole window", () => {
        // Target sits 1000px below the top in a 2000px-tall page (500px
        // viewport). At scrollY=400 the target is still off-screen, so
        // progress must be ~0. If useScroll falls back to whole-window
        // tracking it settles at ~0.27; if the accelerated (ViewTimeline)
        // path mistracks a late-hydrated ref it settles at ~0.36.
        cy.visit("?test=use-scroll-target-late-ref").viewport(100, 500)

        // Wait for the nested ReactDOM root to mount. Assert exactly one
        // instance: if StrictMode's double-invoke leaves two <Repro> trees,
        // fail loudly here rather than silently reading the stale,
        // window-tracking one.
        cy.get("#target").should("have.length", 1)
        cy.get("#progress").should("have.length", 1)

        cy.scrollTo(0, 400)

        // The buggy value does not appear immediately — useScroll starts at
        // 0 and only jumps to the wrong value once its (mis)attached scroll
        // timeline first reports. A bare `.should` would pass on that
        // initial 0 before the bug surfaces (the original false pass that
        // masked this on React 19). Let it settle, THEN assert; `.should`
        // still retries afterwards, so a correct 0 is caught immediately
        // and a regressed ~0.36/~0.27 fails for the full retry window.
        cy.wait(1000)
        cy.get("#progress").should(([$el]: any) => {
            expect(parseFloat($el.innerText)).to.be.lessThan(0.05)
        })
    })
})
