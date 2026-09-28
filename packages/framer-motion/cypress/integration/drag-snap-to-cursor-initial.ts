function expectBoxCenteredAt(x: number, y: number) {
    return cy.get("#box").then(([$box]: any) => {
        const { left, top, width, height } = $box.getBoundingClientRect()
        expect(left + width / 2).to.be.closeTo(x, 1)
        expect(top + height / 2).to.be.closeTo(y, 1)
    })
}

function snapAndDrag() {
    cy.get("#trigger").trigger("pointerdown", 50, 50).nextFrame().wait(50)
    expectBoxCenteredAt(50, 50)

    cy.get("#trigger")
        .trigger("pointermove", 60, 60, { force: true })
        .nextFrame()
        .wait(50)
        .trigger("pointermove", 200, 100, { force: true })
        .nextFrame()
        .wait(50)
    expectBoxCenteredAt(200, 100)

    cy.get("#trigger").trigger("pointerup", 200, 100, { force: true }).wait(50)
    expectBoxCenteredAt(200, 100)
}

describe("snapToCursor with initial coordinates", () => {
    it("centres the element under the pointer on every drag start", () => {
        cy.visit("?test=drag-snap-to-cursor-initial")
            .wait(200)
            .nextFrame()
            .nextFrame()
        expectBoxCenteredAt(650, 90)

        snapAndDrag()
        snapAndDrag()
        snapAndDrag()
    })

    it("centres the element under the pointer after re-renders", () => {
        cy.visit("?test=drag-snap-to-cursor-initial&rerender=true")
            .wait(200)
            .nextFrame()
            .nextFrame()
        expectBoxCenteredAt(650, 90)

        snapAndDrag()
        cy.get("#trigger").should("have.attr", "data-drag-count", "1")
        snapAndDrag()
        cy.get("#trigger").should("have.attr", "data-drag-count", "2")
        snapAndDrag()
    })
})
