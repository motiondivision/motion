describe("AnimatePresence popLayout RTL", () => {
    it("correctly pops exiting elements in RTL direction without shifting", () => {
        let initialLeft: number

        cy.visit("?test=animate-presence-pop-rtl")
            .wait(50)
            .get("#b")
            .then(([$b]: any) => {
                initialLeft = $b.getBoundingClientRect().left
            })
            .get("#container")
            .trigger("click", 60, 60, { force: true })
            .wait(100)
            .get("#b")
            .should(([$b]: any) => {
                const bbox = $b.getBoundingClientRect()
                expect(bbox.left).to.equal(initialLeft)
            })
    })
})
