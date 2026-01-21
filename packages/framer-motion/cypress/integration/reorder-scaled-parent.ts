/**
 * Tests for Reorder with scaled parent.
 * Verifies that reorder items work correctly when inside a parent
 * with a non-default scale transform.
 *
 * Issue: https://github.com/motiondivision/motion/issues/2750
 */
describe("Reorder with scaled parent", () => {
    it("correctly reorders items when parent has scale transform", () => {
        cy.visit("?test=reorder-scaled-parent")
            .wait(200)
            // Get initial positions - item-0 should be first (leftmost)
            .get("[data-testid='item-0']")
            .then(($item0) => {
                const item0Left = $item0[0].getBoundingClientRect().left
                cy.get("[data-testid='item-1']").then(($item1) => {
                    const item1Left = $item1[0].getBoundingClientRect().left
                    // Item 0 should be to the left of item 1
                    expect(item0Left).to.be.lessThan(item1Left)
                })
            })
            // Drag item-0 to the right past item-1
            .get("[data-testid='item-0']")
            .trigger("pointerdown", 40, 40)
            .wait(50)
            .trigger("pointermove", 50, 40, { force: true })
            .wait(50)
            // Move significantly to the right (accounting for scaled space)
            .trigger("pointermove", 120, 40, { force: true })
            .wait(200)
            // After drag, item-1 should now be to the left of item-0
            .get("[data-testid='item-1']")
            .then(($item1) => {
                const item1Left = $item1[0].getBoundingClientRect().left
                cy.get("[data-testid='item-0']").then(($item0) => {
                    const item0Left = $item0[0].getBoundingClientRect().left
                    // Item 1 should now be to the left of item 0
                    expect(item1Left).to.be.lessThan(item0Left)
                })
            })
            .get("[data-testid='item-0']")
            .trigger("pointerup", { force: true })
    })

    it("does not flicker or move erratically during drag", () => {
        const positions: number[] = []

        cy.visit("?test=reorder-scaled-parent")
            .wait(200)
            .get("[data-testid='item-0']")
            .trigger("pointerdown", 40, 40)
            .wait(50)
            .trigger("pointermove", 45, 40, { force: true })
            .wait(50)

        // Perform a slow, steady drag and record positions
        for (let i = 0; i < 5; i++) {
            cy.get("[data-testid='item-0']")
                .trigger("pointermove", 50 + i * 10, 40, { force: true })
                .wait(100)
                .then(($item) => {
                    positions.push($item[0].getBoundingClientRect().left)
                })
        }

        // Verify positions are monotonically increasing (no flickering back)
        cy.wrap(null).then(() => {
            for (let i = 1; i < positions.length; i++) {
                // Allow small tolerance for rounding
                expect(positions[i]).to.be.at.least(
                    positions[i - 1] - 2,
                    `Position at step ${i} should not jump backwards significantly`
                )
            }
        })

        cy.get("[data-testid='item-0']").trigger("pointerup", { force: true })
    })

    it("maintains correct final positions after drag ends", () => {
        cy.visit("?test=reorder-scaled-parent")
            .wait(200)
            // Drag item-0 significantly to the right
            .get("[data-testid='item-0']")
            .trigger("pointerdown", 40, 40)
            .wait(50)
            .trigger("pointermove", 60, 40, { force: true })
            .wait(100)
            .trigger("pointermove", 100, 40, { force: true })
            .wait(100)
            .trigger("pointermove", 140, 40, { force: true })
            .wait(200)
            .trigger("pointerup", { force: true })
            .wait(800) // Wait for animation to complete

        // After dragging item-0 to the right, item-1 should now be first
        // Just verify item-1 is to the left of item-0 (a swap occurred)
        cy.get("[data-testid='item-1']").then(($item1) => {
            cy.get("[data-testid='item-0']").then(($item0) => {
                const item1Left = $item1[0].getBoundingClientRect().left
                const item0Left = $item0[0].getBoundingClientRect().left

                // item-1 should be to the left of item-0 after the swap
                expect(item1Left).to.be.lessThan(
                    item0Left,
                    `After drag, item-1 (at ${item1Left}) should be left of item-0 (at ${item0Left})`
                )
            })
        })
    })
})
