interface BoundingBox {
    top: number
    left: number
    width: number
    height: number
}

function expectBbox(element: HTMLElement, expectedBbox: Partial<BoundingBox>) {
    const bbox = element.getBoundingClientRect()
    expect(bbox.left).to.equal(expectedBbox.left)
    expect(bbox.top).to.equal(expectedBbox.top)
    expectedBbox.width && expect(bbox.width).to.equal(expectedBbox.width)
    expectedBbox.height && expect(bbox.height).to.equal(expectedBbox.height)
}

describe("Nested Scroll/Page", () => {
    it("correctly positions children after dragging", () => {
        cy.visit("?test=drag-framer-page")
            .wait(50)
            .get("#a")
            .should(([$a]: any) => {
                expectBbox($a, {
                    top: 400,
                    left: 110,
                })
            })
            .nextFrame()
            .nextFrame()
            .trigger("pointerdown", 60, 60, { force: true })
            .trigger("pointermove", 50, 50, { force: true }) // Gesture will start from first move past threshold
            .nextFrame()
            .wait(50)
            .trigger("pointermove", 10, 10, { force: true })
            .nextFrame()
            .wait(200)
            .trigger("pointerup")
            .wait(70)
            .should(([$a]: any) => {
                expectBbox($a, {
                    top: 400,
                    left: 50,
                })
            })
            .get("#b")
            .trigger("pointerdown", 60, 60, { force: true })
            .wait(50)
            .get("#a")
            .should(([$a]: any) => {
                expectBbox($a, {
                    top: 400,
                    left: 50,
                })
            })
    })
})
