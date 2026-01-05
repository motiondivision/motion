describe(`LayoutGroup inherit="id"`, () => {
    it("relative children should not instantly jump to new layout", () => {
        cy.viewport(500, 500).visit("?test=layout-group").wait(250)

        // Measure initial position
        let initialTop: number
        cy.get("#button").then(($button) => {
            initialTop = Math.round($button[0].getBoundingClientRect().top)
        })

        // Click expander
        cy.get("#expander").click()

        // Measure position after 100ms
        let top100ms: number
        cy.wait(100).then(() => {
            cy.get("#button").then(($button) => {
                top100ms = Math.round($button[0].getBoundingClientRect().top)
                // Should not be in original or final position
                expect(top100ms).to.not.equal(104)
                expect(top100ms).to.not.equal(initialTop)
            })
        })

        // Measure position after another 200ms for animation to finish
        cy.wait(200).then(() => {
            cy.get("#button").then(($button) => {
                const top200ms = Math.round(
                    $button[0].getBoundingClientRect().top
                )
                expect(top200ms).to.equal(104)
                expect(top200ms).to.not.equal(initialTop)
                expect(top200ms).to.not.equal(top100ms)
            })
        })
    })

    it("relative children should not instantly jump to new layout, after performing their own layout animation", () => {
        cy.viewport(500, 500).visit("?test=layout-group").wait(250)

        // Click button first, then wait 50ms
        cy.get("#button").click()
        cy.wait(50)

        // Measure initial position
        let initialTop: number
        cy.get("#button").then(($button) => {
            initialTop = Math.round($button[0].getBoundingClientRect().top)
        })

        // Click expander
        cy.wait(300).get("#expander").click()

        // Measure position after 100ms
        let top100ms: number
        cy.wait(100).then(() => {
            cy.get("#button").then(($button) => {
                top100ms = Math.round($button[0].getBoundingClientRect().top)

                // Don't be in final or original position
                expect(top100ms).to.not.equal(204)
                expect(top100ms).to.not.equal(initialTop)
            })
        })

        // Measure position after another 100ms (200ms total)
        cy.wait(200).then(() => {
            cy.get("#button").then(($button) => {
                const top200ms = Math.round(
                    $button[0].getBoundingClientRect().top
                )
                // Should not be in either previous measurement
                expect(top200ms).to.equal(204)
                expect(top200ms).to.not.equal(initialTop)
                expect(top200ms).to.not.equal(top100ms)
            })
        })
    })

    it("should return to original state when expander is clicked twice with delay", () => {
        cy.viewport(500, 500).visit("?test=layout-group").wait(250)

        // Measure initial position
        let initialTop: number
        cy.get("#button").then(($button) => {
            initialTop = Math.round($button[0].getBoundingClientRect().top)
        })

        // Click expander
        cy.get("#expander").click()

        // Measure position after 100ms
        let top100ms: number
        cy.wait(100).then(() => {
            cy.get("#button").then(($button) => {
                top100ms = Math.round($button[0].getBoundingClientRect().top)
                // Should not be in original or final position
                expect(top100ms).to.not.equal(104)
                expect(top100ms).to.not.equal(initialTop)
            })
        })

        // Wait 50ms, then click expander again
        cy.wait(50).get("#expander").click()

        // Measure position after animation finishes
        cy.wait(300).then(() => {
            cy.get("#button").then(($button) => {
                const finalTop = Math.round(
                    $button[0].getBoundingClientRect().top
                )
                // Should be back to original state
                expect(finalTop).to.equal(initialTop)
            })
        })
    })
})
