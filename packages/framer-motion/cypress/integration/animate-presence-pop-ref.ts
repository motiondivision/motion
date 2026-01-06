describe("AnimatePresence popLayout with refs", () => {
    it("does not trigger React 19 ref warning with forwardRef components using useImperativeHandle", () => {
        const consoleErrors: string[] = []

        cy.visit("?test=animate-presence-pop-ref", {
            onBeforeLoad(win) {
                // Capture console errors and warnings
                cy.stub(win.console, "error").callsFake((msg) => {
                    consoleErrors.push(String(msg))
                })
                cy.stub(win.console, "warn").callsFake((msg) => {
                    consoleErrors.push(String(msg))
                })
            },
        })
            .wait(200)
            // Verify at least the static element exists (always rendered)
            .get("#static")
            .should("exist")
            // Click to trigger removal and popLayout behavior
            .get("#static")
            .parent()
            .trigger("click", 60, 60, { force: true })
            .wait(200)
            // Verify no React 19 ref warning was logged
            .then(() => {
                const refWarning = consoleErrors.find(
                    (msg) =>
                        msg.includes("element.ref") ||
                        msg.includes("Accessing element.ref")
                )
                expect(
                    refWarning,
                    "Should not have React 19 ref warning"
                ).to.be.undefined
            })
    })

    it("does not trigger React 19 ref warning with forwardRef components with direct ref", () => {
        const consoleErrors: string[] = []

        cy.visit("?test=animate-presence-pop-ref&type=direct", {
            onBeforeLoad(win) {
                // Capture console errors and warnings
                cy.stub(win.console, "error").callsFake((msg) => {
                    consoleErrors.push(String(msg))
                })
                cy.stub(win.console, "warn").callsFake((msg) => {
                    consoleErrors.push(String(msg))
                })
            },
        })
            .wait(200)
            // Verify at least the static element exists (always rendered)
            .get("#static")
            .should("exist")
            // Click to trigger removal
            .get("#static")
            .parent()
            .trigger("click", 60, 60, { force: true })
            .wait(200)
            // Verify no React 19 ref warning was logged
            .then(() => {
                const refWarning = consoleErrors.find(
                    (msg) =>
                        msg.includes("element.ref") ||
                        msg.includes("Accessing element.ref")
                )
                expect(
                    refWarning,
                    "Should not have React 19 ref warning"
                ).to.be.undefined
            })
    })
})
