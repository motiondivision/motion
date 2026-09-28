/**
 * Drag + dragSnapToOrigin + AnimatePresence exit interaction (companion
 * to #3315). After the fix removed VE.unmount's synchronous value.stop(),
 * we want to confirm that:
 *   1. AnimatePresence exit animations still complete and tear the tile down.
 *   2. Toggling the tile back on after a drag yields a clean motion element
 *      (no stranded drag transform from the previous instance).
 */

describe("drag + dragSnapToOrigin + AnimatePresence exit", () => {
    it("exits cleanly after a drag and re-enters without a stranded transform", () => {
        const initial: { left?: number; top?: number } = {}
        cy.visit("?test=drag-snap-animate-presence-exit")
            .wait(200)
            // Capture the tile's initial layout box so we can compare the
            // re-entered instance to it later.
            .get('[data-testid="tile"]')
            .then(([$el]: any) => {
                const r = $el.getBoundingClientRect()
                initial.left = r.left
                initial.top = r.top
            })
            // Drag the tile and release — dragSnapToOrigin animation kicks in.
            .get('[data-testid="tile"]')
            .nextFrame()
            .nextFrame()
            .trigger("pointerdown", 10, 10, { force: true })
            .trigger("pointermove", 20, 10, { force: true })
            .nextFrame()
            .wait(50)
            .trigger("pointermove", 60, 10, { force: true })
            .nextFrame()
            .wait(50)
            .trigger("pointerup", 60, 10, { force: true })
            // Toggle off mid-snap to trigger AnimatePresence exit while
            // the drag motion-value animation is still in flight.
            .get('[data-testid="toggle"]')
            .click()
            .wait(800)
            // AnimatePresence should have torn the tile down.
            .get('[data-testid="tile"]')
            .should("not.exist")
            // Toggle back on and confirm the new tile renders at the
            // same layout position as the first instance — no leftover
            // transform from the previous drag.
            .get('[data-testid="toggle"]')
            .click()
            .wait(500)
            .get('[data-testid="tile"]')
            .should(([$el]: any) => {
                const r = $el.getBoundingClientRect()
                expect(r.left).to.be.closeTo(initial.left!, 2)
                expect(r.top).to.be.closeTo(initial.top!, 2)
            })
    })
})
