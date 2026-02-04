describe("Drag Momentum", () => {
    it("Fast flick after hold produces momentum", () => {
        cy.visit("?test=drag-momentum")
            .wait(200)
            .get("[data-testid='draggable']")
            .trigger("pointerdown", 25, 25)
            .wait(300) // Simulate holding before flick
            .trigger("pointermove", 30, 30) // Cross distance threshold
            .wait(50)
            .trigger("pointermove", 100, 25, { force: true }) // Quick flick
            .wait(16)
            .trigger("pointerup", { force: true })
            .wait(500) // Wait for momentum to carry element
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left } = draggable.getBoundingClientRect()

                // Element should have carried well past the release point
                // due to momentum. Without the fix, velocity is diluted by
                // the stale pointer-down point and momentum is minimal.
                expect(left).to.be.greaterThan(300)
            })
    })

    it("Catch-and-release stops momentum", () => {
        cy.visit("?test=drag-momentum")
            .wait(200)
            .get("[data-testid='draggable']")
            // Perform a drag-and-throw
            .trigger("pointerdown", 25, 25)
            .trigger("pointermove", 30, 30) // Cross distance threshold
            .wait(50)
            .trigger("pointermove", 200, 25, { force: true })
            .wait(16)
            .trigger("pointerup", { force: true })
            // Wait briefly for momentum to start
            .wait(100)
            // Record position, then catch and release
            .then(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left } = draggable.getBoundingClientRect()
                // Store position for later comparison
                $draggable.attr("data-caught-left", Math.round(left))
            })
            .trigger("pointerdown", 25, 25, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .wait(500) // Wait to see if element continues moving
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left } = draggable.getBoundingClientRect()
                const caughtLeft = parseInt(
                    $draggable.attr("data-caught-left"),
                    10
                )

                // Element should stay near where it was caught,
                // not continue with old momentum.
                expect(Math.abs(left - caughtLeft)).to.be.lessThan(50)
            })
    })
})
