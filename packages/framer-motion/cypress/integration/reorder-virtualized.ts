describe("Reorder with virtualized list (@tanstack/react-virtual)", () => {
    it("Preserves all items after reorder", () => {
        cy.visit("?test=reorder-virtualized")
            .wait(200)
            // Verify initial state — 50 items, only a subset visible
            .get("#item-count")
            .should("have.attr", "data-count", "50")
            .get("#visible-count")
            .then(([$el]: any) => {
                const visible = parseInt($el.getAttribute("data-count"))
                expect(visible).to.be.lessThan(50)
                expect(visible).to.be.greaterThan(0)
            })
            // Drag Item 1 down past Item 2
            .get("#Item-1")
            .trigger("pointerdown", 50, 25, { force: true })
            .wait(50)
            .trigger("pointermove", 50, 30, { force: true })
            .wait(50)
            .trigger("pointermove", 50, 55, { force: true })
            .wait(100)
            .trigger("pointerup", 50, 55, { force: true })
            .wait(200)
            // After reorder: all 50 items must still be present
            .get("#item-count")
            .should("have.attr", "data-count", "50")
            .get("#item-order")
            .then(([$el]: any) => {
                const order: string[] = JSON.parse(
                    $el.getAttribute("data-order")
                )
                // All 50 items still present — none lost to virtualization
                expect(order).to.have.length(50)
                const sorted = [...order].sort()
                const expected = Array.from(
                    { length: 50 },
                    (_, i) => `Item ${i}`
                ).sort()
                expect(sorted).to.deep.equal(expected)
                // Item 1 is no longer at index 1 (it was dragged)
                expect(order[1]).to.not.equal("Item 1")
                // Unmeasured items at the end are still there
                expect(order).to.include("Item 49")
            })
    })
})
