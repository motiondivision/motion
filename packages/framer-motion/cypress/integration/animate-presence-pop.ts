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

function runTests(url: string) {
    const name =
        "AnimatePresence popLayout" +
        (url.includes("layout-container") ? " with layout animations" : "")

    describe(name, () => {
        it("correctly pops exiting elements out of the DOM", () => {
            cy.visit(url)
                .wait(50)
                .get("#b")
                .should(([$a]: any) => {
                    expectBbox($a, {
                        top: 200,
                        left: 100,
                        width: 100,
                        height: 100,
                    })
                })
                .get("#c")
                .should(([$a]: any) => {
                    expectBbox($a, {
                        top: 300,
                        left: 100,
                        width: 100,
                        height: 100,
                    })
                })
                .trigger("click", 60, 60, { force: true })
                .wait(100)
                .get("#b")
                .should(([$a]: any) => {
                    expectBbox($a, {
                        top: 200,
                        left: 100,
                        width: 100,
                        height: 100,
                    })
                })
                .get("#c")
                .should(([$a]: any) => {
                    expectBbox($a, {
                        top: 200,
                        left: 100,
                        width: 100,
                        height: 100,
                    })
                })
                .trigger("click", 60, 60, { force: true })
                .wait(100)
                .get("#b")
                .should(([$a]: any) => {
                    expectBbox($a, {
                        top: 200,
                        left: 100,
                        width: 100,
                        height: 100,
                    })
                })
                .get("#c")
                .should(([$a]: any) => {
                    expectBbox($a, {
                        top: 300,
                        left: 100,
                        width: 100,
                        height: 100,
                    })
                })
        })

        it("correctly pops exiting elements out of the DOM when they already have an explicit top/left", () => {
            cy.visit(url + "&position=relative")
                .wait(50)
                .get("#b")
                .should(([$a]: any) => {
                    expectBbox($a, {
                        top: 300,
                        left: 200,
                        width: 100,
                        height: 100,
                    })
                })
                .get("#c")
                .should(([$a]: any) => {
                    expectBbox($a, {
                        top: 400,
                        left: 200,
                        width: 100,
                        height: 100,
                    })
                })
                .trigger("click", 60, 60, { force: true })
                .wait(100)
                .get("#b")
                .should(([$a]: any) => {
                    expectBbox($a, {
                        top: 300,
                        left: 200,
                        width: 100,
                        height: 100,
                    })
                })
                .get("#c")
                .should(([$a]: any) => {
                    expectBbox($a, {
                        top: 300,
                        left: 200,
                        width: 100,
                        height: 100,
                    })
                })
                .trigger("click", 60, 60, { force: true })
                .wait(100)
                .get("#b")
                .should(([$a]: any) => {
                    expectBbox($a, {
                        top: 300,
                        left: 200,
                        width: 100,
                        height: 100,
                    })
                })
                .get("#c")
                .should(([$a]: any) => {
                    expectBbox($a, {
                        top: 400,
                        left: 200,
                        width: 100,
                        height: 100,
                    })
                })
        })

        it("correctly pops exiting elements out of the DOM when anchorX is set to right", () => {
            cy.visit(url + "&anchor-x=right")
                .wait(50)
                .get("#b")
                .should(([$a]: any) => {
                    expectBbox($a, {
                        top: 200,
                        left: 100,
                        width: 100,
                        height: 100,
                    })
                })
                .get("#c")
                .should(([$a]: any) => {
                    expectBbox($a, {
                        top: 300,
                        left: 100,
                        width: 100,
                        height: 100,
                    })
                })
                .trigger("click", 60, 60, { force: true })
                .wait(100)
                .get("#b")
                .should(([$a]: any) => {
                    expectBbox($a, {
                        top: 200,
                        left: 100,
                        width: 100,
                        height: 100,
                    })
                })
                .get("#c")
                .should(([$a]: any) => {
                    expectBbox($a, {
                        top: 200,
                        left: 100,
                        width: 100,
                        height: 100,
                    })
                })
                .trigger("click", 60, 60, { force: true })
                .wait(100)
                .get("#b")
                .should(([$a]: any) => {
                    expectBbox($a, {
                        top: 200,
                        left: 100,
                        width: 100,
                        height: 100,
                    })
                })
                .get("#c")
                .should(([$a]: any) => {
                    expectBbox($a, {
                        top: 300,
                        left: 100,
                        width: 100,
                        height: 100,
                    })
                })
        })
    })
}

runTests("?test=animate-presence-pop")
runTests("?test=animate-presence-pop-layout-container")
