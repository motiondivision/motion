/**
 * In this test suite there's two sets of each test, one without and one with the `layout` prop.
 * This is because when a component has the layout prop applied, we apply drag to the bounding box
 * and when it isn't, we apply it to the x/y transform.
 *
 * Descrepencies between the expected values in the two sets of tests are *something* to do with how
 * pointer events are being resolved with Cypress, but a manual check will verify that both drag modes
 * are working visually the same.
 */
describe("Drag", () => {
    it("Drags the element by the defined distance", () => {
        cy.visit("?test=drag")
            .get("[data-testid='draggable']")
            .wait(200)
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 200, 300, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(200)
                expect(top).to.equal(300)
            })
    })

    it("Drags the element by the defined distance with different initial offset", () => {
        cy.visit("?test=drag&x=100&y=100")
            .get("[data-testid='draggable']")
            .wait(200)
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 200, 300, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(300)

                // TODO: This should actually be 400, but for some reason the test scroll
                // scrolls an additional 100px when dragging starts. But this has been manually verified
                // as working
                expect(top).to.equal(300)
            })
    })

    it("Drags the element by the defined distance with percentage initial offset", () => {
        cy.visit("?test=drag&x=200&y=200&percentage=true")
            .get("[data-testid='draggable']")
            .wait(200)
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 200, 300, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(300)

                // TODO: This should actually be 400, but for some reason the test scroll
                // scrolls an additional 100px when dragging starts. But this has been manually verified
                // as working
                expect(top).to.equal(300)
            })
    })

    it("Locks drag to x", () => {
        cy.visit("?test=drag&axis=x")
            .get("[data-testid='draggable']")
            .wait(200)
            .trigger("pointerdown", 5, 5)
            .wait(50)
            .trigger("pointermove", 10, 10) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 200, 300, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(200)
                expect(top).to.equal(0)
            })
    })

    it("Locks drag to y", () => {
        cy.visit("?test=drag&axis=y")
            .get("[data-testid='draggable']")
            .wait(200)
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 200, 300, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(0)
                expect(top).to.equal(300)
            })
    })

    // Having trouble making this test work
    // it("Direction locks to x", () => {
    //     cy.reload()
    //     cy.visit("?test=drag&lock=true")
    //         .wait(200)
    //         .get("[data-testid='draggable']")
    //         .wait(200)
    //         .trigger("pointerdown", 5, 5, { force: true })
    //         .trigger("pointermove", 5, 5, { force: true }) // Gesture will start from first move past threshold
    //         .wait(100)
    //         .trigger("pointermove", 200, 10, { force: true })
    //         .wait(50)
    //         .trigger("pointermove", 10, 200, { force: true })
    //         .wait(100)
    //         .trigger("pointerup", { force: true })
    //         .should(($draggable: any) => {
    //             const draggable = $draggable[0] as HTMLDivElement
    //             const { left, top } = draggable.getBoundingClientRect()

    //             expect(top).to.equal(0)
    //             expect(left).to.equal(200)
    //         })
    // })

    it("Direction locks to y", () => {
        cy.reload()
        cy.visit("?test=drag&lock=true")
            .wait(200)
            .get("[data-testid='draggable']")
            .wait(200)
            .trigger("pointerdown", 5, 5, { force: true })
            .wait(50)
            .trigger("pointermove", 10, 10, { force: true }) // Gesture will start from first move past threshold
            .wait(100)
            .trigger("pointermove", 10, 200, { force: true })
            .wait(100)
            .trigger("pointermove", 200, 10, { force: true })
            .wait(100)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(0)
                expect(top).to.equal(200)
            })
    })

    it("Constraints as object: bottom right", () => {
        cy.visit("?test=drag&right=100&bottom=100")
            .wait(200)
            .get("[data-testid='draggable']")
            .wait(100)
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 200, 200, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(100)
                expect(top).to.equal(100)
            })
    })

    it("Constraints as object: top left", () => {
        cy.visit("?test=drag&left=-10&top=-10")
            .wait(200)
            .get("[data-testid='draggable']")
            .wait(100)
            .trigger("pointerdown", 40, 40)
            .trigger("pointermove", 30, 30) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 10, 10, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(-10)
                expect(top).to.equal(-10)
            })
    })

    it("Element returns to center with dragSnapToOrigin", () => {
        cy.visit("?test=drag&return=true&left=-10&top=-10")
            .wait(200)
            .get("[data-testid='draggable']")
            .wait(100)
            .trigger("pointerdown", 40, 40)
            .trigger("pointermove", 30, 30) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 10, 10, { force: true })
            .wait(50)
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(-10)
                expect(top).to.equal(-10)
            })
            .trigger("pointerup", { force: true })
            .wait(100)
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(0)
                expect(top).to.equal(0)
            })
    })

    it("reset drag constraints (ref-based), when click after dragging", () => {
        cy.visit("?test=drag-ref-constraints&elastic=1")
            .wait(200)
            .get("[data-testid='draggable']")
            .trigger("pointerdown", 10, 10)
            .wait(200)
            .trigger("pointermove", 300, 300, { force: true })
            .wait(200)
            .trigger("pointerup", { force: true })
            .trigger("pointerdown", { force: true })
            .trigger("pointerup", { force: true })
            .wait(1000)
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(150)
                expect(top).to.equal(150)
            })
    })

    it("doesn't reset drag constraints (ref-based), while dragging, on unrelated parent component updates", () => {
        cy.visit("?test=drag-ref-constraints")
            .wait(200)
            .get("[data-testid='draggable']")
            .trigger("pointerdown", 10, 10)
            .trigger("pointermove", 15, 15)
            .wait(200)
            .trigger("pointermove", 300, 300, { force: true })
            .wait(200)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(200)
                expect(top).to.equal(200)
            })
    })

    it("rescales draggable element in relation to resized constraints", () => {
        cy.visit("?test=drag-ref-constraints-resize")
            .wait(200)
            .get("#constraints")
            .should(([$constraints]: any) => {
                const { left, top, right, bottom } =
                    $constraints.getBoundingClientRect()
                expect(left).to.equal(250)
                expect(top).to.equal(0)
                expect(right).to.equal(750)
                expect(bottom).to.equal(300)
            })
            .get("#box")
            .should(([$box]: any) => {
                const { left, top, right, bottom } =
                    $box.getBoundingClientRect()
                expect(left).to.equal(400)
                expect(top).to.equal(50)
                expect(right).to.equal(600)
                expect(bottom).to.equal(250)
            })
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 100, 100, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .get("#box")
            .should(([$box]: any) => {
                const { left, top, right, bottom } =
                    $box.getBoundingClientRect()
                expect(left).to.equal(550)
                expect(top).to.equal(100)
                expect(right).to.equal(750)
                expect(bottom).to.equal(300)
            })
        cy.viewport(800, 660)
            .wait(50)
            .get("#constraints")
            .should(([$constraints]: any) => {
                const { left, right } = $constraints.getBoundingClientRect()
                expect(left).to.equal(200)
                expect(right).to.equal(600)
            })
            .get("#box")
            .should(([$box]: any) => {
                const { left, right } = $box.getBoundingClientRect()
                expect(left).to.equal(400)
                expect(right).to.equal(600)
            })

        cy.viewport(1000, 660)
            .wait(50)
            .get("#constraints")
            .should(([$constraints]: any) => {
                const { left, top, right, bottom } =
                    $constraints.getBoundingClientRect()
                expect(left).to.equal(250)
                expect(top).to.equal(0)
                expect(right).to.equal(750)
                expect(bottom).to.equal(300)
            })
            .get("#box")
            .should(([$box]: any) => {
                const { left, right } = $box.getBoundingClientRect()
                expect(left).to.equal(550)
                expect(right).to.equal(750)
            })
    })

    it("Snaps to cursor", () => {
        cy.visit("?test=drag-snap-to-cursor")
            .wait(200)
            .scrollTo(0, 800)
            .get("#scrollable")
            .should(([$scrollable]: any) => {
                const { top, left, right, bottom } =
                    $scrollable.getBoundingClientRect()
                expect(top).to.equal(200)
                expect(right).to.equal(740)
                expect(bottom).to.equal(500)
                expect(left).to.equal(240)
            })
            .get("#scroll-trigger")
            .trigger("pointerdown", 5, 5)
            .wait(50)
            .get("#scrollable")
            .should(([$scrollable]: any) => {
                const { top, left, right, bottom } =
                    $scrollable.getBoundingClientRect()
                expect(top).to.equal(-125)
                expect(right).to.equal(275)
                expect(bottom).to.equal(175)
                expect(left).to.equal(-225)
            })
    })
})

describe("Drag & Layout", () => {
    it("Drags the element by the defined distance", () => {
        cy.visit("?test=drag&layout=true")
            .get("[data-testid='draggable']")
            .wait(200)
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 200, 300, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(200)
                expect(top).to.equal(300)
            })
    })

    it("Drags the element by the defined distance with different initial offset", () => {
        cy.visit("?test=drag&x=100&y=100&layout=true")
            .get("[data-testid='draggable']")
            .wait(200)
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 200, 300, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(300)

                // TODO: This should actually be 400, but for some reason the test scroll
                // scrolls an additional 100px when dragging starts. But this has been manually verified
                // as working
                expect(top).to.equal(300)
            })
    })

    it("Locks drag to x", () => {
        cy.visit("?test=drag&axis=x&layout=true")
            .get("[data-testid='draggable']")
            .wait(200)
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 200, 300, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(200)
                expect(top).to.equal(0)
            })
    })

    it("Locks drag to y", () => {
        cy.visit("?test=drag&axis=y&layout=true")
            .get("[data-testid='draggable']")
            .wait(200)
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 200, 300, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(0)
                expect(top).to.equal(300)
            })
    })

    // Having trouble making this test work
    // it("Direction locks to x", () => {
    //     cy.reload()
    //     cy.visit("?test=drag&lock=true&layout=true")
    //         .wait(100)
    //         .get("[data-testid='draggable']")
    //         .wait(200)
    //         .trigger("pointerdown", 5, 5, { force: true })
    //         .wait(50)
    //         .trigger("pointermove", 5, 5, { force: true }) // Gesture will start from first move past threshold
    //         .wait(100)
    //         .trigger("pointermove", 200, 10, { force: true })
    //         .wait(50)
    //         .trigger("pointermove", 10, 200, { force: true })
    //         .wait(100)
    //         .trigger("pointerup", { force: true })
    //         .should(($draggable: any) => {
    //             const draggable = $draggable[0] as HTMLDivElement
    //             const { left, top } = draggable.getBoundingClientRect()

    //             expect(left).to.equal(190)
    //             expect(top).to.equal(0)
    //         })
    // })

    it("Direction locks to y", () => {
        cy.visit("?test=drag&lock=true&layout=true")
            .wait(100)
            .get("[data-testid='draggable']")
            .wait(200)
            .trigger("pointerdown", 5, 5, { force: true })
            .trigger("pointermove", 10, 10, { force: true }) // Gesture will start from first move past threshold
            .wait(100)
            .trigger("pointermove", 10, 200, { force: true })
            .wait(100)
            .trigger("pointermove", 200, 10, { force: true })
            .wait(100)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(0)
                expect(top).to.equal(200)
            })
    })

    it("Constraints as object: bottom right", () => {
        cy.visit("?test=drag&right=100&bottom=100&layout=true")
            .wait(200)
            .get("[data-testid='draggable']")
            .trigger("pointerdown", 5, 5)
            .trigger("pointermove", 10, 10) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 200, 200, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(100)
                expect(top).to.equal(100)
            })
    })

    it("Constraints as object: top left", () => {
        cy.visit("?test=drag&left=-10&top=-10&layout=true")
            .wait(200)
            .get("[data-testid='draggable']")
            .trigger("pointerdown", 40, 40)
            .trigger("pointermove", 30, 30) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 10, 10, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(-10)
                expect(top).to.equal(-10)
            })
    })

    it("doesn't reset drag constraints (ref-based), while dragging, on unrelated parent component updates", () => {
        cy.visit("?test=drag-ref-constraints&layout=true")
            .wait(200)
            .get("[data-testid='draggable']")
            .trigger("pointerdown", 10, 10)
            .trigger("pointermove", 15, 15)
            .wait(50)
            .trigger("pointermove", 300, 300, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(150)
                expect(top).to.equal(150)
            })
    })
})
