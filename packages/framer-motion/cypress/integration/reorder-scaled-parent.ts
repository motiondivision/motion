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
 */
function domOrder(): Cypress.Chainable<string[]> {
    return cy.get("#reorder-group [data-testid]").then(($items) =>
        Cypress._.map($items, (el) => el.getAttribute("data-testid") as string)
    )
}

describe("Reorder inside a scaled parent (#2449 / #2750)", () => {
    it("dragged item tracks the cursor with correctParentTransform (scale 0.5)", () => {
        cy.visit("?test=reorder-scaled-parent&corrected=true&scale=0.5")
            .wait(300)
            .get("[data-testid='item-0']")
            .then(($el: any) => {
                const start = $el[0].getBoundingClientRect()
                const startMidX = start.left + start.width / 2
                const startMidY = start.top + start.height / 2

                cy.wrap($el)
                    .trigger("pointerdown", startMidX, startMidY, {
                        force: true,
                    })
                    .wait(50)
                    // Move past the drag threshold.
                    .trigger("pointermove", startMidX, startMidY + 5, {
                        force: true,
                    })
                    .wait(50)
                    // Move the pointer 80px down the screen.
                    .trigger("pointermove", startMidX, startMidY + 80, {
                        force: true,
                    })
                    .wait(80)
                    .then(([item]: any) => {
                        const moved = item.getBoundingClientRect()
                        const movedMidY = moved.top + moved.height / 2
                        const screenDelta = movedMidY - startMidY

                        // The element must follow the cursor (~80px on screen),
                        // not 80 / scale (160px) as it would without the
                        // transformPagePoint correction.
                        expect(screenDelta).to.be.greaterThan(60)
                        expect(screenDelta).to.be.lessThan(100)
                    })
                    .trigger("pointerup", { force: true })
            })
    })

    it("reorders correctly and settles aligned with correctParentTransform", () => {
        cy.visit("?test=reorder-scaled-parent&corrected=true&scale=0.5")
            .wait(300)

        domOrder().should("deep.equal", [
            "item-0",
            "item-1",
            "item-2",
            "item-3",
        ])

        cy.get("[data-testid='item-0']").then(($el: any) => {
            const start = $el[0].getBoundingClientRect()
            const startMidX = start.left + start.width / 2
            const startMidY = start.top + start.height / 2

            let chain = cy
                .wrap($el)
                .trigger("pointerdown", startMidX, startMidY, { force: true })
                .wait(50)
                // Move past the drag threshold first.
                .trigger("pointermove", startMidX, startMidY + 6, {
                    force: true,
                })
                .wait(50)

            // Steady drag downward. With scale 0.5 the offset is corrected
            // into local space, so the on-screen distance must be ~2x the
            // local row pitch to cross item-1's centre. Incremental moves
            // keep a non-zero velocity so checkReorder engages.
            for (let i = 1; i <= 6; i++) {
                chain = chain
                    .trigger("pointermove", startMidX, startMidY + i * 14, {
                        force: true,
                    })
                    .wait(60)
            }

            chain.trigger("pointerup", { force: true }).wait(700)
        })

        // item-0 should have moved down past item-1 (a swap occurred) ...
        domOrder().then((order) => {
            expect(order.indexOf("item-0")).to.be.greaterThan(
                order.indexOf("item-1"),
                `expected item-0 to sit below item-1, got ${order.join(",")}`
            )
        })

        // ... and the released item should settle flush in the list, i.e. no
        // stranded drag transform (translateY ≈ 0 in local space).
        cy.get("[data-testid='item-0']").then(($el: any) => {
            const transform = getComputedStyle($el[0]).transform
            if (transform && transform !== "none") {
                const parts = transform.match(/matrix\(([^)]+)\)/)
                if (parts) {
                    const translateY = parseFloat(parts[1].split(",")[5])
                    expect(Math.abs(translateY)).to.be.lessThan(10)
                }
            }
        })
    })
})
