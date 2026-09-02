/**
 * Reorder inside a parent with a raw CSS `transform: scale()` and a non-centre
 * `transform-origin`.
 *
 * Issues: https://github.com/motiondivision/motion/issues/2449
 *         https://github.com/motiondivision/motion/issues/2750
 *
 * Raw CSS transforms on ancestors are invisible to the projection / drag
 * measurement system, so without correction the dragged item does not track
 * the cursor and reorder thresholds fire at the wrong positions. The supported
 * workaround is `correctParentTransform(ref)` via `MotionConfig
 * transformPagePoint`. These tests pin that workaround so future drag /
 * projection refactors can't silently regress it.
 *
 * Pointer coords are element-relative (same pattern as `drag-scaled-parent.ts`).
 * PanSession applies pointermove on the next animation frame, so end-state
 * checks use `.should()` — a single `.then()` after a fixed wait races RAF
 * on slow CI.
 */
function itemOrder($items: any): string[] {
    return Cypress._.map(
        $items,
        (el) => el.getAttribute("data-testid") as string
    )
}

describe("Reorder inside a scaled parent (#2449 / #2750)", () => {
    it("dragged item tracks the cursor with correctParentTransform (scale 0.5)", () => {
        cy.visit("?test=reorder-scaled-parent&corrected=true&scale=0.5")
        cy.get("[data-testid='item-0']").should("be.visible")

        cy.get("[data-testid='item-0']").then(($el: any) => {
            const start = $el[0].getBoundingClientRect()
            const startMidY = start.top + start.height / 2

            cy.wrap($el)
                .trigger("pointerdown", 20, 10, { force: true })
                .wait(50)
                // Move past the drag threshold.
                .trigger("pointermove", 20, 16, { force: true })
                .wait(50)
                // Move the pointer 80px down the screen.
                .trigger("pointermove", 20, 90, { force: true })

            // Drag tracking is 1:1, not a tween: retry until the frame loop
            // applies the pointermove. A wrong scale (e.g. 40px uncorrected)
            // stays wrong and still fails.
            cy.wrap($el).should(($item: any) => {
                const moved = $item[0].getBoundingClientRect()
                const screenDelta = moved.top + moved.height / 2 - startMidY

                // The element must follow the cursor (~80px on screen),
                // not 80 / scale (160px) or 80 * scale (40px) as it would
                // without the transformPagePoint correction.
                expect(screenDelta).to.be.greaterThan(60)
                expect(screenDelta).to.be.lessThan(100)
            })

            cy.wrap($el).trigger("pointerup", { force: true })
        })
    })

    it("reorders correctly and settles aligned with correctParentTransform", () => {
        cy.visit("?test=reorder-scaled-parent&corrected=true&scale=0.5")
        cy.get("[data-testid='item-0']").should("be.visible")

        cy.get("#reorder-group [data-testid]").should(($items) => {
            expect(itemOrder($items)).to.deep.equal([
                "item-0",
                "item-1",
                "item-2",
                "item-3",
            ])
        })

        // Element-relative moves. Scale 0.5 → ~40px screen is ~80px local,
        // enough to cross item-1's centre (needs >35px local) without
        // racing through the whole list.
        cy.get("[data-testid='item-0']")
            .trigger("pointerdown", 20, 10, { force: true })
            .wait(50)
            .trigger("pointermove", 20, 16, { force: true })
            .wait(50)
            .trigger("pointermove", 20, 35, { force: true })
            .wait(50)
            .trigger("pointermove", 20, 50, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })

        cy.get("#reorder-group [data-testid]").should(($items) => {
            const order = itemOrder($items)
            expect(order.indexOf("item-0")).to.be.greaterThan(
                order.indexOf("item-1"),
                `expected item-0 to sit below item-1, got ${order.join(",")}`
            )
        })

        // List sits flush: 10px local gap × 0.5 scale = 5px screen, no
        // leftover drag/layout transform. Retry until springs finish.
        cy.get("#reorder-group [data-testid]").should(($items) => {
            const boxes = [...$items].map((el) => el.getBoundingClientRect())
            for (let i = 1; i < boxes.length; i++) {
                expect(boxes[i].top).to.be.closeTo(boxes[i - 1].bottom + 5, 4)
            }
        })
    })
})
