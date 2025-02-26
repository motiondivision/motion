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

describe("Layout animation", () => {
    it("Correctly fires layout={true} animations and fires onLayoutAnimationStart and onLayoutAnimationComplete", () => {
        cy.visit("?test=layout")
            .wait(50)
            .get("#box")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 0,
                    left: 0,
                    width: 100,
                    height: 200,
                })
            })
            .trigger("click")
            .wait(50)
            /**
             * Test that onLayoutAnimationStart fires
             */
            .should(([$box]: any) => {
                expect($box.style.backgroundColor).to.equal("green")
            })
            .wait(50)
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 200,
                    height: 250,
                })
            })
            /**
             * Test that onLayoutAnimationComplete fires
             */
            .wait(300)
            .should(([$box]: any) => {
                expect($box.style.backgroundColor).to.equal("blue")
            })
    })

    it(`It correctly fires layout="position" animations`, () => {
        cy.visit("?test=layout&type=position")
            .wait(50)
            .get("#box")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 0,
                    left: 0,
                    width: 100,
                    height: 200,
                })
            })
            .trigger("click")
            .wait(50)
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 300,
                    height: 300,
                })
            })
    })

    it(`It correctly fires layout="size" animations`, () => {
        cy.visit("?test=layout&type=size")
            .wait(50)
            .get("#box")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 0,
                    left: 0,
                    width: 100,
                    height: 200,
                })
            })
            .trigger("click")
            .wait(100)
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 100,
                    left: 200,
                    width: 200,
                    height: 250,
                })
            })
    })

    it("Doesn't initiate a new animation if the viewport box hasn't updated between renders", () => {
        cy.visit("?test=layout-interrupt")
            .wait(50)
            .get("#box")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 0,
                    left: 0,
                    width: 100,
                    height: 200,
                })
            })
            .trigger("click")
            .wait(50)
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 200,
                    height: 250,
                })
            })
            /**
             * The easing curve is set to always return t=0.5, so if this box moves it means
             * a new animation has started
             */
            .trigger("click")
            .wait(50)
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 200,
                    height: 250,
                })
            })
    })

    it("Doesn't initiate a new animation if layoutDependency hasn't changed", () => {
        cy.visit("?test=layout-dependency")
            .wait(50)
            .get("#box")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 0,
                    left: 0,
                    width: 100,
                    height: 200,
                })
            })
            .trigger("click")
            .wait(50)
            .should(([$box]: any) => {
                expectBbox($box, {
                    height: 300,
                    left: 200,
                    top: 100,
                    width: 300,
                })
            })
            /**
             * The easing curve is set to always return t=0.5, so if this box moves it means
             * a new animation has started
             */
            .trigger("click")
            .wait(50)
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 0,
                    left: 0,
                    width: 100,
                    height: 200,
                })
            })
    })

    it("Exiting children correctly animate when layoutDependency changes", () => {
        let initialBbox: BoundingBox

        cy.visit("?test=layout-dependency-child")
            .wait(50)
            .get("#child")
            .should(([$child]: any) => {
                initialBbox = $child.getBoundingClientRect()
            })
            .get("button")
            .trigger("click")
            .wait(100)
            .get("#child")
            .should(([$childAfter]: any) => {
                const afterBbox = $childAfter.getBoundingClientRect()

                expect(afterBbox.top).to.equal(initialBbox.top)
                expect(afterBbox.left).to.equal(initialBbox.left)
                expect(afterBbox.width).to.equal(initialBbox.width)
                expect(afterBbox.height).to.equal(initialBbox.height)
            })
    })

    it("Has a correct bounding box when a transform is applied", () => {
        cy.visit("?test=layout-scaled-child-in-transformed-parent")
            .wait(50)
            .get("#box")
            .should(([$box]: any) => {
                expectBbox($box, {
                    height: 100,
                    left: 200,
                    top: 150,
                    width: 100,
                })
            })
            .trigger("click")
            .wait(50)
            .should(([$box]: any) => {
                expectBbox($box, {
                    height: 100,
                    left: 225,
                    top: 150,
                    width: 75,
                })
            })
    })

    it("Newly-entering elements animate as expected", () => {
        cy.visit("?test=layout-repeat-new")
            .wait(50)
            .get("#add")
            .trigger("click")
            .wait(50)
            .get("#box-0")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 50,
                    left: 0,
                    width: 160,
                    height: 100,
                })
            })
            .get("#add")
            .trigger("click")
            .wait(50)
            .get("#box-1")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 50,
                    left: 0,
                    width: 160,
                    height: 100,
                })
            })
            .get("#box-0")
            .should(([$box]: any) => {
                const bbox = $box.getBoundingClientRect()
                expect(bbox.left).not.to.equal(170)
            })
            .get("#reset")
            .trigger("click")
            .wait(50)
            .get("#add")
            .trigger("click")
            .wait(50)
            .get("#box-0")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 50,
                    left: 0,
                    width: 160,
                    height: 100,
                })
            })
            .get("#add")
            .trigger("click")
            .wait(50)
            .get("#box-0")
            .should(([$box]: any) => {
                const bbox = $box.getBoundingClientRect()
                expect(bbox.left).not.to.equal(170)
            })
    })

    it("Elements within portal don't perform scale correction on parents", () => {
        cy.visit("?test=layout-portal")
            .wait(50)
            .get("#parent")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 0,
                    left: 0,
                    width: 100,
                    height: 100,
                })
            })
            .get("#child")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 100,
                    left: 0,
                    width: 100,
                    height: 100,
                })
            })
            .get("#parent")
            .trigger("click")
            .wait(50)
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 0,
                    left: 0,
                    width: 200,
                    height: 200,
                })
            })
            .get("#child")
            .wait(50)
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 200,
                    left: 0,
                    width: 100,
                    height: 100,
                })
            })
    })

    it("A new layout animation isn't started if the target doesn't change", () => {
        cy.visit("?test=layout-rerender")
            .wait(50)
            .get("button")
            .trigger("click")
            .wait(200)
            .get("#render-count")
            .should(([$count]: any) => {
                expect($count.textContent).to.equal("1")
            })
    })

    it("A new layout animation isn't started if the target doesn't change, even if parent starts layout animation", () => {
        cy.visit("?test=layout-rerender&parent=true")
            .wait(50)
            .get("button")
            .trigger("click")
            .wait(200)
            .get("#render-count")
            .should(([$count]: any) => {
                expect($count.textContent).to.equal("1")
            })
    })
})
