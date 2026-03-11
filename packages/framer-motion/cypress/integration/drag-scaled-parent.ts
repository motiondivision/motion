describe("Drag with scaled parent", () => {
    it("Element follows cursor when parent has scale(0.5)", () => {
        cy.visit("?test=drag-scaled-parent")
            .wait(200)
            .get("[data-testid='draggable']")
            .wait(100)
            .trigger("pointerdown", 10, 10)
            .trigger("pointermove", 15, 15) // Past threshold
            .wait(50)
            .trigger("pointermove", 110, 110, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($el: any) => {
                const el = $el[0] as HTMLDivElement
                const { left, top } = el.getBoundingClientRect()

                // Parent has scale(0.5) with transformOrigin: top left
                // Element starts at (0,0) in parent space, which renders at (0,0) on screen
                // After dragging to pointermove(110,110) from pointerdown(10,10),
                // the screen delta is 100px.
                // The element should follow the cursor, so its rendered position
                // should be near the pointer position.
                // Without fix: left ≈ 50 (half of expected, because translate(100)
                // in a scale(0.5) parent renders as 50px)
                // With fix: left ≈ 100 (element follows cursor)
                expect(left).to.be.greaterThan(80)
                expect(left).to.be.lessThan(120)
                expect(top).to.be.greaterThan(80)
                expect(top).to.be.lessThan(120)
            })
    })

    it("Element follows cursor when parent has scale(2)", () => {
        cy.visit("?test=drag-scaled-parent&scale=2")
            .wait(200)
            .get("[data-testid='draggable']")
            .wait(100)
            .trigger("pointerdown", 10, 10)
            .trigger("pointermove", 15, 15) // Past threshold
            .wait(50)
            .trigger("pointermove", 110, 110, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($el: any) => {
                const el = $el[0] as HTMLDivElement
                const { left, top } = el.getBoundingClientRect()

                // Parent has scale(2) with transformOrigin: top left
                // Screen delta is 100px.
                // Without fix: left ≈ 200 (double, because translate(100)
                // in a scale(2) parent renders as 200px)
                // With fix: left ≈ 100 (element follows cursor)
                expect(left).to.be.greaterThan(80)
                expect(left).to.be.lessThan(120)
                expect(top).to.be.greaterThan(80)
                expect(top).to.be.lessThan(120)
            })
    })
})
