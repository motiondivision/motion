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

describe("Shared layout: Toggle multiple times", () => {
    it("Should allow multiple toggles", () => {
        cy.visit("?test=layout-shared-toggle-multiple")
            .wait(50)
            .get("button")
            .click()
            .wait(200)
            .get("#a")
            .should(([$box]: any) => {
                const bbox = $box.getBoundingClientRect()
                expect(bbox.left).not.to.equal(0)
            })
            .get("#b")
            .should(([$box]: any) => {
                const bbox = $box.getBoundingClientRect()
                expect(bbox.left).not.to.equal(0)
            })
            .get("button")
            .click()
            .wait(200)
            .get("#a")
            .should(([$box]: any) => {
                const bbox = $box.getBoundingClientRect()
                expect(bbox.left).not.to.equal(0)
            })
            .get("button")
            .click()
            .wait(200)
            .get("#a")
            .should(([$box]: any) => {
                const bbox = $box.getBoundingClientRect()
                expect(bbox.left).not.to.equal(0)
            })
            .get("#b")
            .should(([$box]: any) => {
                const bbox = $box.getBoundingClientRect()
                expect(bbox.left).not.to.equal(0)
            })
            .get("button")
            .click()
            .wait(200)
            .get("#a")
            .should(([$box]: any) => {
                const bbox = $box.getBoundingClientRect()
                expect(bbox.left).not.to.equal(0)
            })
    })
})

describe("Shared layout: A -> B transition", () => {
    it("When performing crossfade animation, removed element isn't removed until animation is complete", () => {
        cy.visit("?test=layout-shared-animate-presence")
            .wait(50)
            .get("#shape-0")
            .should(([$box]: any) => {
                expect($box.style.opacity).to.equal("1")
            })
            .trigger("click")
            .wait(50)
            // Lose reference to orignal element
            .get("#shape-1")
            .get("#shape-0")
            .should(([$box]: any) => {
                expect($box.style.opacity).to.equal("1")
            })
            .get("#shape-1")
            .should(([$box]: any) => {
                expect($box.style.opacity).to.equal("0.433013")
            })
    })
})

describe("Shared layout: A -> B transition", () => {
    it("Correctly fires layout={true} animations and fires onLayoutAnimationStart and onLayoutAnimationComplete", () => {
        cy.visit("?test=layout-shared-switch-a-b")
            .wait(50)
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 0,
                    left: 0,
                    width: 100,
                    height: 200,
                })
                expect(getComputedStyle($box).opacity).to.equal("0.4")
            })
            .trigger("click")
            .wait(200)
            .get("#b")
            /**
             * Test that onLayoutAnimationStart fires
             */
            .should(([$box]: any) => {
                expect($box.style.backgroundColor).to.equal("rgb(0, 255, 0)")
                expect(window.getComputedStyle($box).borderRadius).to.equal(
                    "5% / 4%"
                )
                expect(getComputedStyle($box).opacity).to.equal("0.7")
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
            .wait(2000)
            .should(([$box]: any) => {
                expect($box.style.backgroundColor).to.equal("rgb(0, 0, 255)")
            })
            .trigger("click")
            .wait(200)
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 200,
                    height: 250,
                })
            })
    })

    it(`It correctly fires layout="position" animations`, () => {
        cy.visit("?test=layout-shared-switch-a-b&type=position")
            .wait(50)
            .get("#a")
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
            .get("#b")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 300,
                    height: 300,
                })
            })
            .trigger("click")
            .wait(50)
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 25,
                    left: 50,
                    width: 100,
                    height: 200,
                })
            })
    })

    it(`It correctly fires layout="size" animations`, () => {
        cy.visit("?test=layout-shared-switch-a-b&type=size")
            .wait(50)
            .get("#a")
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
            .get("#b")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 100,
                    left: 200,
                    width: 200,
                    height: 250,
                })
            })
            .trigger("click")
            .wait(50)
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 0,
                    left: 0,
                    width: 150,
                    height: 225,
                })
            })
    })
})

describe("Shared layout: A -> AB -> A switch transition", () => {
    it.skip("Correctly fires layout={true} animations and fires onLayoutAnimationComplete", () => {
        cy.visit("?test=layout-shared-switch-a-ab")
            .wait(50)
            .get("#a")
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
            .get("#a")
            .should(([$box]: any) => {
                expect($box.style.visibility).to.equal("hidden")
            })
            .get("#b")
            .should(([$box]: any) => {
                expect(parseFloat($box.style.opacity)).to.equal(1)
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 200,
                    height: 250,
                })
            })
            .trigger("click")
            .wait(50)
            .get("#a")
            .should(([$box]: any) => {
                expect($box.style.visibility).not.to.equal("hidden")
                expectBbox($box, {
                    top: 25,
                    left: 50,
                    width: 100,
                    height: 125,
                })
            })
    })

    it.skip(`It correctly fires layout="position" animations`, () => {
        cy.visit("?test=layout-shared-switch-a-ab&type=position")
            .wait(50)
            .get("#a")
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
            .get("#b")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 300,
                    height: 300,
                })
            })
            .trigger("click")
            .wait(50)
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 100,
                    height: 200,
                })
            })
    })
})

describe("Shared layout: 0 -> A -> B -> 0 transition", () => {
    it("Correctly fires layout={true} animations", () => {
        cy.visit("?test=layout-shared-switch-0-a-b-0")
            .wait(50)
            .get("#trigger")
            .trigger("click")
            .wait(50)
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 0,
                    left: 0,
                    width: 100,
                    height: 200,
                })
            })
            .get("#trigger")
            .trigger("click")
            .wait(50)
            .get("#b")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 200,
                    height: 250,
                })
            })
            .get("#trigger")
            .trigger("click")
            .wait(50)
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 25,
                    left: 50,
                    width: 150,
                    height: 225,
                })
            })
    })
})

describe("Shared layout: 0 -> A -> AB -> A -> 0 transition", () => {
    it("Correctly fires layout={true} animations", () => {
        cy.visit("?test=layout-shared-switch-0-a-b-0")
            .wait(50)
            .get("#trigger")
            .trigger("click")
            .wait(50)
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 0,
                    left: 0,
                    width: 100,
                    height: 200,
                })
            })
            .get("#trigger")
            .trigger("click")
            .wait(50)
            .get("#b")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 200,
                    height: 250,
                })
            })
            .get("#trigger")
            .trigger("click")
            .wait(50)
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 25,
                    left: 50,
                    width: 150,
                    height: 225,
                })
            })
    })
})

describe("Shared layout: A -> B crossfade transition", () => {
    it("Correctly fires layout={true} animations and fires onLayoutAnimationStart and onLayoutAnimationComplete", () => {
        cy.visit("?test=layout-shared-switch-a-b")
            .wait(50)
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 0,
                    left: 0,
                    width: 100,
                    height: 200,
                })
            })
            .trigger("click")
            .wait(200)
            .get("#b")
            .should(([$box]: any) => {
                expect($box.style.backgroundColor).to.equal("rgb(0, 255, 0)")
                expect(window.getComputedStyle($box).borderRadius).to.equal(
                    "5% / 4%"
                )
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
            .wait(2000)
            .should(([$box]: any) => {
                expect($box.style.backgroundColor).to.equal("rgb(0, 0, 255)")
            })
            .trigger("click")
            .wait(200)
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 200,
                    height: 250,
                })
            })
    })

    it(`It correctly fires layout="position" animations`, () => {
        cy.visit("?test=layout-shared-switch-a-b&type=position")
            .wait(50)
            .get("#a")
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
            .get("#b")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 300,
                    height: 300,
                })
            })
            .trigger("click")
            .wait(50)
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 25,
                    left: 50,
                    width: 100,
                    height: 200,
                })
            })
    })

    it(`It correctly fires layout="size" animations`, () => {
        cy.visit("?test=layout-shared-switch-a-b&type=size")
            .wait(50)
            .get("#a")
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
            .get("#b")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 100,
                    left: 200,
                    width: 200,
                    height: 250,
                })
            })
            .trigger("click")
            .wait(50)
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 0,
                    left: 0,
                    width: 150,
                    height: 225,
                })
            })
    })

    it("It correctly fires layout={true} animations when the component has a transformTemplate", () => {
        cy.visit("?test=layout-shared-crossfade-a-b-transform-template")
            .wait(50)
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 150,
                    left: 200,
                    width: 100,
                    height: 200,
                })
            })
            .trigger("click")
            .wait(100)
            .get("#b")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 125,
                    left: 150,
                    width: 200,
                    height: 250,
                })
            })
            // interrupt the animation
            .trigger("click")
            .wait(100)
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 137.5,
                    left: 175,
                    width: 150,
                    height: 225,
                })
            })
    })
})

describe("Shared layout: A -> AB -> A crossfade transition", () => {
    it("Correctly fires layout={true} animations and fires onLayoutAnimationComplete", () => {
        cy.visit("?test=layout-shared-crossfade-a-ab")
            .wait(50)
            .get("#a")
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
            .get("#a")
            .should(([$box]: any) => {
                expect(parseFloat($box.style.opacity) || 1).to.equal(1)
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 200,
                    height: 250,
                })
            })
            .get("#b")
            .should(([$box]: any) => {
                expect(parseFloat($box.style.opacity) || 1).to.equal(1)
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 200,
                    height: 250,
                })
            })
        // .trigger("click")
        // .wait(50)
        // .get("#a")
        // .should(([$box]: any) => {
        //     expect($box.style.visibility).not.to.equal("hidden")
        //     expectBbox($box, {
        //         top: 25,
        //         left: 50,
        //         width: 100,
        //         height: 125,
        //     })
        // })
        // .get("#b")
        // .should(([$box]: any) => {
        //     expect($box.style.visibility).not.to.equal("hidden")
        //     expectBbox($box, {
        //         top: 25,
        //         left: 50,
        //         width: 100,
        //         height: 125,
        //     })
        // })
    })

    it(`It correctly fires layout="position" animations`, () => {
        cy.visit("?test=layout-shared-crossfade-a-ab&type=position")
            .wait(50)
            .get("#a")
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
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 100,
                    height: 200,
                })
            })
            .get("#b")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 300,
                    height: 300,
                })
            })
    })

    it(`It correctly animates layout="preserve-aspect" as "position" animations if aspect ratios are different`, () => {
        cy.visit("?test=layout-shared-crossfade-a-ab&type=preserve-aspect")
            .wait(50)
            .get("#a")
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
            .get("#a")
            .should(([$box]: any) => {
                expect(parseFloat($box.style.opacity) || 1).to.equal(1)
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 100,
                    height: 200,
                })
            })
            .get("#b")
            .should(([$box]: any) => {
                expect(parseFloat($box.style.opacity) || 1).to.equal(1)
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 300,
                    height: 300,
                })
            })
    })

    it(`It correctly doesn't animate if layout="preserve-aspect" if size is different and position is the same`, () => {
        cy.visit(
            "?test=layout-shared-crossfade-a-ab&type=preserve-aspect&move=no"
        )
            .wait(50)
            .get("#a")
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
            .get("#a")
            .should(([$box]: any) => {
                expect(parseFloat($box.style.opacity) || 1).to.equal(1)
                expectBbox($box, {
                    top: 0,
                    left: 0,
                    width: 100,
                    height: 200,
                })
            })
            .get("#b")
            .should(([$box]: any) => {
                expect(parseFloat($box.style.opacity) || 1).to.equal(1)
                expectBbox($box, {
                    top: 0,
                    left: 0,
                    width: 300,
                    height: 300,
                })
            })
    })

    it(`It correctly doesn't animate if layout="preserve-aspect" on same element if size and position are the same`, () => {
        cy.visit("?test=layout-preserve-ratio")
            .wait(50)
            .get("#a")
            .should(([$box]: any) => {
                expect(Math.round($box.getBoundingClientRect().width)).to.equal(
                    200
                )
            })
            .trigger("click")
            .wait(50)
            .should(([$box]: any) => {
                expect(Math.round($box.getBoundingClientRect().width)).to.equal(
                    100
                )
            })
            .trigger("click")
            .wait(50)
            .should(([$box]: any) => {
                expect(Math.round($box.getBoundingClientRect().width)).to.equal(
                    200
                )
            })
            .trigger("click")
            .wait(50)
            .should(([$box]: any) => {
                expect(Math.round($box.getBoundingClientRect().width)).to.equal(
                    100
                )
            })
    })

    it(`It correctly animates layout="preserve-aspect" as normal layout animations if both aspect ratios are the same`, () => {
        cy.visit(
            "?test=layout-shared-crossfade-a-ab&type=preserve-aspect&size=same"
        )
            .wait(50)
            .get("#a")
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
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 200,
                    height: 400,
                })
            })
            .get("#b")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 200,
                    height: 400,
                })
            })
    })

    it("Correctly fires layout={true} animations after an instant transition", () => {
        cy.visit("?test=layout-shared-instant-transition-a-ab-a")
            .wait(50)
            .get("#a")
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
            .get("#a")
            // a shouldn't change since the update is blocked
            .should(([$box]: any) => {
                expect(parseFloat($box.style.opacity) || 1).to.equal(1)
                expectBbox($box, {
                    top: 0,
                    left: 0,
                    width: 100,
                    height: 200,
                })
            })
            .get("#b")
            // b should have its identical layout
            .should(([$box]: any) => {
                expect(parseFloat($box.style.opacity) || 1).to.equal(1)
                expectBbox($box, {
                    top: 100,
                    left: 200,
                    width: 300,
                    height: 300,
                })
            })
            .trigger("click")
            .wait(50)
            // half way back to a
            .get("#a")
            .should(([$box]: any) => {
                expect(parseFloat($box.style.opacity) || 1).to.equal(1)
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 200,
                    height: 250,
                })
            })
    })
})

describe("Shared layout: 0 -> A -> B -> 0 crossfade transition", () => {
    it("Correctly fires layout={true} animations", () => {
        cy.visit("?test=layout-shared-switch-0-a-b-0")
            .wait(50)
            .get("#trigger")
            .trigger("click")
            .wait(50)
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 0,
                    left: 0,
                    width: 100,
                    height: 200,
                })
            })
            .get("#trigger")
            .trigger("click")
            .wait(50)
            .get("#b")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 200,
                    height: 250,
                })
            })
            .get("#trigger")
            .trigger("click")
            .wait(50)
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 25,
                    left: 50,
                    width: 150,
                    height: 225,
                })
            })
    })
})

describe("Shared layout:  0 -> A -> AB -> A -> 0 crossfade transition", () => {
    it("Correctly fires layout={true} animations", () => {
        cy.visit("?test=layout-shared-switch-0-a-b-0")
            .wait(50)
            .get("#trigger")
            .trigger("click")
            .wait(50)
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 0,
                    left: 0,
                    width: 100,
                    height: 200,
                })
            })
            .get("#trigger")
            .trigger("click")
            .wait(50)
            .get("#b")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 50,
                    left: 100,
                    width: 200,
                    height: 250,
                })
            })
            .trigger("click")
            .wait(50)
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 25,
                    left: 50,
                    width: 150,
                    height: 225,
                })
            })
    })
})

describe("Shared layout: nested crossfade transition", () => {
    it("Correctly fires layout={true} animations", () => {
        cy.visit("?test=layout-shared-crossfade-nested")
            .wait(50)
            .get("#a")
            .trigger("click")
            .wait(50)
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 200,
                    left: 200,
                    width: 200,
                    height: 250,
                })
            })
            .get("#child")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 200,
                    left: 200,
                    width: 100,
                    height: 100,
                })
            })
            .get("#b")
            .trigger("click")
            .wait(50)
            .get("#b")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 150,
                    left: 200,
                    width: 150,
                    height: 225,
                })
            })
            .get("#child")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 150,
                    left: 200,
                    width: 100,
                    height: 100,
                })
            })
    })

    it("Correctly fires layout={true} animations when there are divs with `display: contents` in the path", () => {
        cy.visit("?test=layout-shared-crossfade-nested-display-contents")
            .wait(50)
            .get("#a")
            .trigger("click")
            .wait(250)
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 200,
                    left: 200,
                    width: 200,
                    height: 250,
                })
            })
            .get("#child")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 200,
                    left: 200,
                    width: 100,
                    height: 100,
                })
            })
            .get("#b")
            .trigger("click")
            .wait(250)
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 150,
                    left: 200,
                    width: 150,
                    height: 225,
                })
            })
            .get("#child")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 150,
                    left: 200,
                    width: 100,
                    height: 100,
                })
            })
    })
})

describe("Shared layout: component unmounts in a LayoutGroup", () => {
    it("Should trigger sibling animation when unmount", () => {
        cy.visit("?test=layout-group-unmount")
            .wait(50)
            .get("#a")
            .trigger("click")
            .wait(50)
            .get("#b")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 90,
                    left: 20,
                    width: 100,
                    height: 100,
                })
            })
    })

    it("If a sibling's position relative to the parent has changed, it should remain at its position", () => {
        let bbox: any
        cy.visit("?test=layout-group-unmount-list")
            .wait(50)
            .get("#b")
            .then(([$box]: any) => {
                bbox = $box.getBoundingClientRect()
            })
            .get("#a")
            .trigger("click")
            .wait(50)
            .get("#b")
            .should(([$box]: any) => {
                expectBbox($box, bbox)
            })
    })
})

describe("Shared layout: A -> undefined -> B transition", () => {
    it("After removing an element with a layoutId, the next element with that ID should not animate from the last element", () => {
        cy.visit("?test=layout-shared-clear-snapshots")
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
            .get("button")
            .click()
            .wait(50)
            .click()
            .wait(50)
            .get("#box")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 100,
                    left: 200,
                    width: 100,
                    height: 100,
                })
            })
    })

    it("As previous, but with rendering layout projecting sibling that is not removed", () => {
        cy.visit("?test=layout-shared-clear-snapshots&sibling=true")
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
            .get("button")
            .click()
            .wait(50)
            .click()
            .wait(50)
            .get("#box")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 100,
                    left: 200,
                    width: 100,
                    height: 100,
                })
            })
    })
})

describe("Shared pointer events", () => {
    it("Applies pointer-events: none to follow elements", () => {
        cy.visit("?test=layout-follow-pointer-events")
            .wait(50)
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 0,
                    left: 0,
                    width: 100,
                    height: 200,
                })
            })
            .click()
            .wait(200)
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 200,
                    left: 0,
                    width: 300,
                    height: 300,
                })
            })
            .get("#b")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 200,
                    left: 0,
                    width: 300,
                    height: 300,
                })
            })
            .click()
            .wait(200)
            .get("#a")
            .should(([$box]: any) => {
                expectBbox($box, {
                    top: 0,
                    left: 0,
                    width: 100,
                    height: 200,
                })
            })
    })
})

describe("Shared layout: Works with queueMicrotasks", () => {
    it("queueMicrotasks doesn't break layout measurements", () => {
        cy.visit("?test=layout-queuemicrotask")
            .wait(50)
            .get("#target")
            .trigger("click")
            .wait(150)
            .get("#open")
            .trigger("click")
            .wait(150)
            .get("#target")
            .trigger("click")
            .wait(150)
            .get("#open")
            .trigger("click")
            .wait(150)
            .get("#error")
            .should(([$error]: any) => {
                expect($error.innerText).to.equal("")
            })
    })
})

describe("Shared layout: Measures rotated elements correctly when animation is interrupted", () => {
    it("Measures correctly", () => {
        let boundingBox: BoundingBox
        cy.visit("?test=layout-shared-rotate")
            .wait(50)
            .get("#box")
            .trigger("click")
            .wait(50)
            .get("#box")
            .should(([$box]: any) => {
                boundingBox = $box.getBoundingClientRect()
            })
            .trigger("click")
            .wait(50)
            .get("#box")
            .should(([$box]: any) => {
                expectBbox($box, boundingBox)
            })
    })
})

describe("Shared layout: Border radius", () => {
    it("Should animate border radius", () => {
        cy.visit("?test=layout-shared-border-radius")
            .wait(50)
            .get("#next")
            .click()
            .wait(200)
            .get(".measure-box")
            .should(([$boxA, $boxB]: any) => {
                const boxAStyle = window.getComputedStyle($boxA)
                const boxBStyle = window.getComputedStyle($boxB)
                expect(boxAStyle.borderRadius).not.to.equal("0%")
                expect(boxBStyle.borderRadius).not.to.equal("0%")
                expect(boxBStyle.borderRadius).to.equal(boxAStyle.borderRadius)
            })
    })
})
