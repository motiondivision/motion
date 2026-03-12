describe("AnimatePresence exit with height", () => {
    it("Exit animation is not instant when closing an accordion item", () => {
        cy.visit("?test=animate-presence-exit-height")
            .wait(200)
            // Item A starts open — click it to close
            .get('[data-id="a"]')
            .trigger("click", { force: true })
            // Wait 2s into a 10s linear exit animation (should be ~80% height)
            .wait(2000)
            .get('[data-panel="a"]')
            .then(($el: any) => {
                const el = $el[0] as HTMLElement
                const height = parseFloat(getComputedStyle(el).height)
                // If the exit animation is working, height should still be > 0
                // at 20% through a 10s animation
                expect(height).to.be.greaterThan(0)
            })
    })

    it("Exit animation eventually removes the element", () => {
        cy.visit("?test=animate-presence-exit-height")
            .wait(200)
            .get('[data-id="a"]')
            .trigger("click", { force: true })
            // Wait for full 10s exit + buffer
            .wait(11000)
            .get('[data-panel="a"]')
            .should("not.exist")
    })

    it("Opening a new item while another exits animates both", () => {
        cy.visit("?test=animate-presence-exit-height")
            .wait(200)
            // Click item B to open it (closes item A)
            .get('[data-id="b"]')
            .trigger("click", { force: true })
            .wait(2000)
            // Item A should still be mid-exit (height > 0)
            .get('[data-panel="a"]')
            .then(($el: any) => {
                const height = parseFloat(
                    getComputedStyle($el[0] as HTMLElement).height
                )
                expect(height).to.be.greaterThan(0)
            })
            // Item B should be mid-enter (height > 0)
            .get('[data-panel="b"]')
            .then(($el: any) => {
                const height = parseFloat(
                    getComputedStyle($el[0] as HTMLElement).height
                )
                expect(height).to.be.greaterThan(0)
            })
    })

    it("Interrupting enter animation does not break exit animation", () => {
        cy.visit("?test=animate-presence-exit-height")
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
        cy.visit("?test=animate-presence-exit-height")
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
