/**
 * Tests for issue #2458: Drag constraints should update when the
 * draggable element or constraint container resizes.
 *
 * The test page has:
 * - Container (#constraints): 500x500
 * - Draggable (#box): starts 100x100, resizable to 300x300 via button
 *
 * Before resize: max travel = 400px (500 - 100)
 * After resize: max travel = 200px (500 - 300)
 */
describe("Drag Constraints Update on Element Resize", () => {
    it("Constrains drag correctly before resize", () => {
        cy.visit("?test=drag-ref-constraints-element-resize")
            .wait(200)
            .get("#box")
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10)
            .wait(50)
            .trigger("pointermove", 600, 600, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .wait(50)
            .should(($box: any) => {
                const box = $box[0] as HTMLDivElement
                const { right, bottom } = box.getBoundingClientRect()
                // 100x100 box in 500x500 container: max right/bottom = 500
                expect(right).to.be.at.most(502)
                expect(bottom).to.be.at.most(502)
            })
    })

    it("Updates drag constraints after draggable element is resized", () => {
        cy.visit("?test=drag-ref-constraints-element-resize")
            .wait(200)

        // Click resize button to resize draggable from 100x100 to 300x300
        cy.get("#resize-trigger")
            .click()
            .wait(200)

        // Verify the box is now 300x300
        cy.get("#box").should(($box: any) => {
            const box = $box[0] as HTMLDivElement
            const { width, height } = box.getBoundingClientRect()
            expect(width).to.equal(300)
            expect(height).to.equal(300)
        })

        // Now drag to the far bottom-right
        cy.get("#box")
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10)
            .wait(50)
            .trigger("pointermove", 600, 600, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .wait(50)
            .should(($box: any) => {
                const box = $box[0] as HTMLDivElement
                const { right, bottom } = box.getBoundingClientRect()
                // 300x300 box in 500x500 container: max right/bottom = 500
                // Without the fix, right/bottom would be ~700 (300 + 400 old constraint)
                expect(right).to.be.at.most(502)
                expect(bottom).to.be.at.most(502)
            })
    })

    it("Updates drag constraints after draggable element is resized, with existing drag offset", () => {
        cy.visit("?test=drag-ref-constraints-element-resize")
            .wait(200)

        // First drag to an intermediate position
        cy.get("#box")
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10)
            .wait(50)
            .trigger("pointermove", 100, 100, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .wait(50)

        // Resize the element from 100x100 to 300x300
        cy.get("#resize-trigger")
            .click()
            .wait(200)

        // Now drag far to the bottom-right
        cy.get("#box")
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10)
            .wait(50)
            .trigger("pointermove", 600, 600, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .wait(50)
            .should(($box: any) => {
                const box = $box[0] as HTMLDivElement
                const { right, bottom } = box.getBoundingClientRect()
                // Even after a prior drag + resize, box must stay within container
                expect(right).to.be.at.most(502)
                expect(bottom).to.be.at.most(502)
            })
    })
})
