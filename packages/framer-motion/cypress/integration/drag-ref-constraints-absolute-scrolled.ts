/**
 * Tests for issue #2829: Drag with ref-based constraints on a viewport-sized
 * element (`position: absolute; inset: 0`) should allow dragging to the bottom
 * of the visible viewport, even when the page is loaded with scroll restored.
 *
 * The test page scrolls the window in a layout effect before drag is wired up,
 * mimicking the browser restoring scroll position on refresh.
 */
describe("Drag with ref constraints on absolute element after scroll", () => {
    it("Allows dragging to the visible bottom of the viewport after scroll", () => {
        cy.viewport(1000, 800)
            .visit("?test=drag-ref-constraints-absolute-scrolled&scroll=300")
            .wait(300)
            .window()
            .then((win) => {
                expect(win.scrollY).to.be.greaterThan(0)
            })
            .get("[data-testid='draggable']")
            .nextFrame()
            .nextFrame()
            .trigger("pointerdown", 5, 5, { force: true })
            .trigger("pointermove", 10, 10, { force: true })
            .nextFrame()
            .wait(50)
            .trigger("pointermove", 900, 1500, { force: true })
            .nextFrame()
            .wait(50)
            .trigger("pointerup", { force: true })
            .wait(100)
            .should(($el: any) => {
                const el = $el[0] as HTMLDivElement
                const rect = el.getBoundingClientRect()
                // viewport: 1000x800, scroll: 300, box: 50x50
                // Constraint is `position: absolute; inset: 0` (viewport-sized
                // at the document origin). After the page is loaded scrolled,
                // the visible portion of the constraint spans viewport y ∈
                // [0, 500]. Before the fix, drag constraints were computed
                // with a stale scroll offset, clamping the box's bottom to
                // ~200 (= viewportH - 2*scrollY - boxH). With the fix, the
                // box should reach the constraint's visible bottom (~500).
                expect(rect.bottom).to.be.closeTo(500, 5)
            })
    })
})
