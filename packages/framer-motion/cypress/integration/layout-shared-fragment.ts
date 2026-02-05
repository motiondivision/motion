interface BoundingBox {
    top: number
    left: number
    width: number
    height: number
}

function expectBbox(element: HTMLElement, expectedBbox: BoundingBox) {
    const bbox = element.getBoundingClientRect()
    expect(bbox.left).to.equal(expectedBbox.left)
    expect(bbox.top).to.equal(expectedBbox.top)
    expect(bbox.width).to.equal(expectedBbox.width)
    expect(bbox.height).to.equal(expectedBbox.height)
}

describe("Shared layout: Fragment", () => {
    it("Elements with layoutId inside a Fragment should animate from the correct starting position", () => {
        cy.visit("?test=layout-shared-fragment")
            .wait(50)
            .get("#box")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 100,
                    left: 0,
                    width: 100,
                    height: 100,
                })
            })
            .trigger("click")
            .wait(200)
            .get("#box")
            .should(([$box]: any) => {
                // At ease: () => 0.5, the element should be halfway
                // between top: 100 and top: 300, i.e. top: 200.
                // If the bug is present, it will start from top: 0
                // and be at top: 150 instead.
                const bbox = $box.getBoundingClientRect()
                expect(bbox.top).to.equal(200)
            })
    })
})
