interface BoundingBox {
    top: number
    left: number
    width: number
    height: number
}

function expectBbox(element: HTMLElement, expectedBbox: BoundingBox) {
    const bbox = element.getBoundingClientRect()
    expect(Math.round(bbox.left)).to.equal(expectedBbox.left)
    expect(Math.round(bbox.top)).to.equal(expectedBbox.top)
    expect(Math.round(bbox.width)).to.equal(expectedBbox.width)
    expect(Math.round(bbox.height)).to.equal(expectedBbox.height)
}

describe("Read initial transform during layout animation", () => {
    it("Should not read a projection transform as the initial transform", () => {
        cy.visit("?test=layout-read-transform")
            .wait(400)
            .get("#box")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 0,
                    left: 0,
                    width: 200,
                    height: 200,
                })
            })
    })
})
