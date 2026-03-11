describe("Drag Momentum", () => {
    it("Fast flick after hold produces momentum", () => {
        cy.visit("?test=drag-momentum")
            .wait(200)
            .get("[data-testid='draggable']")
            .wait(200)
            .trigger("pointerdown", 25, 900, { force: true })
            .wait(300) // Simulate holding before flick
            .trigger("pointermove", 25, 895, { force: true }) // Cross distance threshold
            .wait(50)
            .trigger("pointermove", 25, 800, { force: true }) // Quick flick upward
            .wait(50)
            .trigger("pointerup", { force: true })
            .wait(500) // Wait for momentum to carry element
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { top } = draggable.getBoundingClientRect()

                // Element should have carried well past the release point
                // due to momentum. Without the fix, velocity is diluted by
                // the stale pointer-down point and momentum is minimal.
                expect(top).to.be.lessThan(-200)
            })
    })

    it("Catch-and-release stops momentum", () => {
        cy.visit("?test=drag-momentum")
            .wait(200)
            .get("[data-testid='draggable']")
            .wait(200)
            // Perform a drag-and-throw upward
            .trigger("pointerdown", 25, 900, { force: true })
            .trigger("pointermove", 25, 895, { force: true }) // Cross distance threshold
            .wait(50)
            .trigger("pointermove", 25, 700, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            // Wait for momentum to start
            .wait(100)
            // Record position, then catch and release
            .then(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { top } = draggable.getBoundingClientRect()
                $draggable.attr("data-caught-top", Math.round(top))
            })
            .trigger("pointerdown", 25, 500, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .wait(500) // Wait to see if element continues moving
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { top } = draggable.getBoundingClientRect()
                const caughtTop = parseInt(
                    $draggable.attr("data-caught-top"),
                    10
                )

                // Element should stay near where it was caught,
                // not continue with old momentum.
                expect(Math.abs(top - caughtTop)).to.be.lessThan(50)
            })
    })
})
