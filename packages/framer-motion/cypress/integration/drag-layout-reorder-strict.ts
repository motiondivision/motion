/**
 * Test for issue #3169: Drag + layout + React 19 StrictMode
 *
 * Simulates Ant Design Tree behavior:
 * 1. Memoized file components (don't re-render on parent state changes)
 * 2. Layout changes above the dragged element (folder expansion)
 *
 * The projection system must compensate even when the dragged file's
 * willUpdate() was never called because the component didn't re-render.
 */
describe("Drag layout reorder in StrictMode", () => {
    it("Maintains drag position when content is inserted above (memoized component)", () => {
        cy.visit("?test=drag-layout-reorder-strict")
            .wait(200)
            // Start dragging File1 downward
            .get("[data-testid='file-File1']")
            .trigger("pointerdown", 100, 15, { force: true })
            .wait(50)
            .trigger("pointermove", 100, 20, { force: true })
            .wait(50)
            // Drag down slightly
            .trigger("pointermove", 100, 80, { force: true })
            .wait(200)
            // Record position before expanding Folder1
            .get("[data-testid='file-File1']")
            .then(($el: any) => {
                const preExpandTop = $el[0].getBoundingClientRect().top

                // Expand Folder1 — this inserts 3 items (~105px total)
                // ABOVE the dragged file, shifting it down in the DOM
                cy.window().invoke("expandFolder", "Folder1")
                cy.wait(500)

                // Verify expansion happened
                cy.get("[data-testid='placeholder-Existing1a']").should(
                    "exist"
                )

                // The dragged file MUST stay near its pre-expand position.
                // Without the fix, the file would jump down by ~105px
                // because the memoized component's willUpdate() is never
                // called, so the projection system has no snapshot and
                // skips drag compensation.
                cy.get("[data-testid='file-File1']").should(($post: any) => {
                    const postExpandTop =
                        $post[0].getBoundingClientRect().top
                    expect(postExpandTop).to.be.within(
                        preExpandTop - 50,
                        preExpandTop + 50,
                        `File1 jumped from ${preExpandTop} to ${postExpandTop} after folder expand`
                    )
                })
            })
            // Release drag
            .get("[data-testid='file-File1']")
            .trigger("pointerup", { force: true })
    })

    it("Maintains drag position on simple hover state change", () => {
        cy.visit("?test=drag-layout-reorder-strict")
            .wait(200)
            .get("[data-testid='file-File1']")
            .trigger("pointerdown", 100, 15, { force: true })
            .wait(50)
            .trigger("pointermove", 100, 20, { force: true })
            .wait(50)
            .trigger("pointermove", 100, 80, { force: true })
            .wait(200)
            .get("[data-testid='file-File1']")
            .then(($el: any) => {
                const preHoverTop = $el[0].getBoundingClientRect().top

                // Trigger hover state change (re-renders layout siblings)
                cy.window().invoke("hoverFolder", "Folder3")
                cy.wait(300)

                cy.get("#result").should(
                    "have.attr",
                    "data-hovered",
                    "Folder3"
                )

                cy.get("[data-testid='file-File1']").should(($post: any) => {
                    const postHoverTop =
                        $post[0].getBoundingClientRect().top
                    expect(postHoverTop).to.be.within(
                        preHoverTop - 30,
                        preHoverTop + 30,
                        `File1 jumped from ${preHoverTop} to ${postHoverTop} after folder hover`
                    )
                })
            })
            .get("[data-testid='file-File1']")
            .trigger("pointerup", { force: true })
    })
})
