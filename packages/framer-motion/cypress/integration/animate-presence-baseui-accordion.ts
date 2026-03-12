describe("AnimatePresence with Base UI Accordion", () => {
    it("Exit animation is not instant when closing an accordion item", () => {
        cy.visit("?test=animate-presence-baseui-accordion")
            .wait(200)
            // Item A starts open — click it to close
            .get('[data-id="a"]')
            .trigger("click", { force: true })
            // Wait 2s into a 10s linear exit animation
            .wait(2000)
            .get('[data-panel="a"]')
            .then(($el: any) => {
                const el = $el[0] as HTMLElement
                const height = parseFloat(getComputedStyle(el).height)
                // If the exit animation is working, the panel should still
                // have visible height 2s into a 10s animation
                expect(height).to.be.greaterThan(0)
            })
    })

    it("Interrupting enter animation does not break exit animation", () => {
        cy.visit("?test=animate-presence-baseui-accordion")
            .wait(200)
            // Open item B (starts its enter animation, closes item A)
            .get('[data-id="b"]')
            .trigger("click", { force: true })
            // Wait just 500ms — item B is still mid-enter
            .wait(500)
            // Immediately close item B (interrupt the enter animation)
            .get('[data-id="b"]')
            .trigger("click", { force: true })
            // Wait 2s into the exit animation
            .wait(2000)
            .get('[data-panel="b"]')
            .then(($el: any) => {
                const el = $el[0] as HTMLElement
                const height = parseFloat(getComputedStyle(el).height)
                // The exit animation should still be running, not instant
                expect(height).to.be.greaterThan(0)
            })
    })

    it("Switching items mid-enter animates the exit", () => {
        cy.visit("?test=animate-presence-baseui-accordion")
            .wait(200)
            // Open item B (starts enter, item A starts exit)
            .get('[data-id="b"]')
            .trigger("click", { force: true })
            // Wait 500ms — item B is mid-enter
            .wait(500)
            // Switch to item C (interrupts B's enter, B should exit)
            .get('[data-id="c"]')
            .trigger("click", { force: true })
            // Wait a bit for the exit animation to be in progress
            .wait(2000)
            // Item B should be mid-exit (height > 0)
            .get('[data-panel="b"]')
            .then(($el: any) => {
                const height = parseFloat(
                    getComputedStyle($el[0] as HTMLElement).height
                )
                expect(height).to.be.greaterThan(0)
            })
            // Item C should be mid-enter (height > 0)
            .get('[data-panel="c"]')
            .then(($el: any) => {
                const height = parseFloat(
                    getComputedStyle($el[0] as HTMLElement).height
                )
                expect(height).to.be.greaterThan(0)
            })
    })
})
