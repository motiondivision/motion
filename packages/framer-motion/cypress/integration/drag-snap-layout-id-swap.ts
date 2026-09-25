/**
 * Regression test for issue #3315.
 *
 * Tiles use `drag` + `dragSnapToOrigin` + `layoutId` in an absolutely-
 * positioned grid. When same-row tiles swap, React 19's reorder
 * reconciliation briefly unmounts and remounts the dragged component;
 * if the VisualElement's unmount cancels in-flight motion-value
 * animations, the dragSnapToOrigin animation dies before remount can
 * resubscribe and the tile renders at "new layout + stranded drag offset".
 *
 * Note: The bug only manifests under React 19's reconciliation. The Cypress
 * runner targets the React 19 dev app (`cypress.react-19.json`), so the
 * regression gate is on that config; the React 18 run passes either way.
 */
describe("drag + dragSnapToOrigin + layoutId horizontal swap", () => {
    it("does not strand the drag transform after a same-row swap", () => {
        cy.visit("?test=drag-snap-layout-id-swap")
            .wait(200)
            .get('[data-testid="tile-0"]')
            .should(([$el]: any) => {
                const r = $el.getBoundingClientRect()
                expect(r.left).to.be.closeTo(50, 2)
                expect(r.top).to.be.closeTo(50, 2)
            })
            // Drag tile-0 right ~60px (one column) onto tile-1's slot.
            // Pointermoves are element-relative; we keep the move small so
            // the recomputed-as-element-moves coordinate system still lands
            // the pointer on tile-1.
            .nextFrame()
            .nextFrame()
            .trigger("pointerdown", 5, 5, { force: true })
            .trigger("pointermove", 10, 5, { force: true })
            .nextFrame()
            .wait(50)
            .trigger("pointermove", 35, 5, { force: true })
            .nextFrame()
            .wait(50)
            .trigger("pointerup", 35, 5, { force: true })
            .wait(2000)
            .get("#grid")
            .should(([$grid]: any) => {
                // Confirm the state-level swap happened.
                expect($grid.getAttribute("data-tile-state")).to.match(
                    /^1,0,/
                )
            })
            .get('[data-testid="tile-0"]')
            .should(([$el]: any) => {
                const r = $el.getBoundingClientRect()
                // Tile 0 swapped into column 1: 50 (padding) + 60 (column).
                // The bug would leave it at ~170 (col 1 + stranded drag).
                expect(r.left).to.be.closeTo(110, 2)
                expect(r.top).to.be.closeTo(50, 2)
            })
            .get('[data-testid="tile-1"]')
            .should(([$el]: any) => {
                const r = $el.getBoundingClientRect()
                expect(r.left).to.be.closeTo(50, 2)
                expect(r.top).to.be.closeTo(50, 2)
            })
    })
})
