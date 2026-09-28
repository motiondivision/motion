/**
 * Tests for issue #2903: Drag constraints should update when the
 * draggable element is resized via a path that bypasses React state
 * (e.g. CSS `resize: both` or imperative DOM resizing — the scenario
 * described in the linked CodeSandbox).
 *
 * - Container (#constraints): 500x500
 * - Draggable (#box): starts 100x100, grows to 300x300 when
 *   #resize-trigger is clicked. The handler mutates the element's
 *   inline style directly so the only signal of the size change is
 *   ResizeObserver — projection's normal lifecycle does not fire.
 *
 * Before resize: max travel = 400px (500 - 100)
 * After resize:  max travel = 200px (500 - 300)
 */
describe("Drag Constraints Update on Imperative Resize", () => {
    it("Updates drag constraints when element grows via direct DOM mutation", () => {
        cy.visit("?test=drag-ref-constraints-resize-handle").wait(200)

        cy.get("#resize-trigger").click().wait(200)

        cy.get("#box").should(($box: any) => {
            const box = $box[0] as HTMLDivElement
            const { width, height } = box.getBoundingClientRect()
            expect(width).to.equal(300)
            expect(height).to.equal(300)
        })

        cy.get("#box")
            .nextFrame()
            .nextFrame()
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10)
            .nextFrame()
            .wait(50)
            .trigger("pointermove", 600, 600, { force: true })
            .nextFrame()
            .wait(50)
            .trigger("pointerup", { force: true })
            .wait(50)
            .should(($box: any) => {
                const box = $box[0] as HTMLDivElement
                const { right, bottom } = box.getBoundingClientRect()
                // 300x300 box must stay inside the 500x500 container.
                // Without the fix, right/bottom would be ~700.
                expect(right).to.be.at.most(502)
                expect(bottom).to.be.at.most(502)
            })
    })
})
