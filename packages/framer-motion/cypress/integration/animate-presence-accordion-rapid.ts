describe("AnimatePresence accordion rapid click (#2674)", () => {
    it("Toggling open mid-exit leaves the panel visible at full height", () => {
        cy.visit("?test=animate-presence-accordion-rapid")
            .wait(200)
            .get('[data-panel="a"]')
            .should("not.exist")
            // Open
            .get('[data-id="a"]')
            .trigger("click", { force: true })
            // Wait for full open animation
            .wait(800)
            // Close
            .get('[data-id="a"]')
            .trigger("click", { force: true })
            // Mid-exit (250ms into 500ms exit), re-open
            .wait(250)
            .get('[data-id="a"]')
            .trigger("click", { force: true })
            // Wait for animation to settle
            .wait(1500)
            // Panel should exist at full height
            .get('[data-panel="a"]')
            .should("exist")
            .then(($el: any) => {
                const height = parseFloat(
                    getComputedStyle($el[0] as HTMLElement).height
                )
                const opacity = parseFloat(
                    getComputedStyle($el[0] as HTMLElement).opacity
                )
                expect(height).to.be.greaterThan(100)
                expect(opacity).to.equal(1)
            })
    })

    it("Toggling closed mid-enter removes the panel", () => {
        cy.visit("?test=animate-presence-accordion-rapid")
            .wait(200)
            // Open
            .get('[data-id="a"]')
            .trigger("click", { force: true })
            // Mid-enter (250ms into 500ms enter), close
            .wait(250)
            .get('[data-id="a"]')
            .trigger("click", { force: true })
            // Wait for exit to finish
            .wait(1500)
            .get('[data-panel="a"]')
            .should("not.exist")
    })

    it("Rapidly toggling many times ends in correct state (open)", () => {
        cy.visit("?test=animate-presence-accordion-rapid")
            .wait(200)
            // 5 rapid clicks → ends open
            .get('[data-id="a"]')
            .trigger("click", { force: true })
            .wait(50)
            .get('[data-id="a"]')
            .trigger("click", { force: true })
            .wait(50)
            .get('[data-id="a"]')
            .trigger("click", { force: true })
            .wait(50)
            .get('[data-id="a"]')
            .trigger("click", { force: true })
            .wait(50)
            .get('[data-id="a"]')
            .trigger("click", { force: true })
            .wait(2000)
            .get('[data-panel="a"]')
            .should("exist")
            .then(($el: any) => {
                const height = parseFloat(
                    getComputedStyle($el[0] as HTMLElement).height
                )
                const opacity = parseFloat(
                    getComputedStyle($el[0] as HTMLElement).opacity
                )
                expect(height).to.be.greaterThan(100)
                expect(opacity).to.equal(1)
            })
    })
})
