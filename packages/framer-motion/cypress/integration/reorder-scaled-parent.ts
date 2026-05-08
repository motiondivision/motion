describe("Reorder inside a parent with scale transform (#2857)", () => {
    it("Element follows the cursor 1:1 with parent scale: '100%'", () => {
        cy.visit("?test=reorder-scaled-parent")
            .wait(200)
            .get("#Tomato")
            .then(($el: any) => {
                const startRect = ($el[0] as HTMLElement).getBoundingClientRect()
                const startMidX = startRect.left + startRect.width / 2
                const startMidY = startRect.top + startRect.height / 2

                cy.wrap($el)
                    .trigger("pointerdown", startMidX, startMidY, {
                        force: true,
                    })
                    .wait(50)
                    .trigger("pointermove", startMidX, startMidY + 5, {
                        force: true,
                    })
                    .wait(50)
                    .trigger("pointermove", startMidX, startMidY + 30, {
                        force: true,
                    })
                    .wait(50)
                    .then(([item]: any) => {
                        const movedRect = (
                            item as HTMLElement
                        ).getBoundingClientRect()
                        const movedMidY =
                            movedRect.top + movedRect.height / 2
                        const screenDelta = movedMidY - startMidY

                        expect(screenDelta).to.be.greaterThan(20)
                        expect(screenDelta).to.be.lessThan(40)
                    })
                    .trigger("pointerup", startMidX, startMidY + 30, {
                        force: true,
                    })
            })
    })
})
