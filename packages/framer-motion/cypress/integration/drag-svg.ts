/**
 * In this test suite there's two sets of each test, one without and one with the `layout` prop.
 * This is because when a component has the layout prop applied, we apply drag to the bounding box
 * and when it isn't, we apply it to the x/y transform.
 *
 * Descrepencies between the expected values in the two sets of tests are *something* to do with how
 * pointer events are being resolved with Cypress, but a manual check will verify that both drag modes
 * are working visually the same.
 */
describe("Drag SVG", () => {
    it("Drags the element by the defined distance", () => {
        cy.visit("?test=drag-svg")
            .wait(50)
            .get("[data-testid='draggable']")
            .trigger("pointerdown", 50, 50, { force: true })
            .wait(50)
            .trigger("pointermove", 60, 60, { force: true }) // Gesture will start from first move past threshold
            .wait(100)
            .trigger("pointermove", 210, 310, { force: true })
            .wait(100)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(200)
                expect(top).to.equal(300)
            })
    })

    it("Locks drag to x", () => {
        cy.visit("?test=drag-svg&axis=x")
            .get("[data-testid='draggable']")
            .wait(200)
            .trigger("pointerdown", 50, 50, { force: true })
            .trigger("pointermove", 60, 60, { force: true }) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 200, 300, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(190)
                expect(top).to.equal(30)
            })
    })

    it("Locks drag to y", () => {
        cy.visit("?test=drag-svg&axis=y")
            .get("[data-testid='draggable']")
            .wait(200)
            .trigger("pointerdown", 50, 50, { force: true })
            .trigger("pointermove", 60, 60, { force: true }) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 200, 300, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(30)
                expect(top).to.equal(290)
            })
    })

    // TODO: Figure out direction lock tests in Cypress
    // it("Direction locks to x", () => {
    //     cy.visit("?test=drag-svg&lock=true")
    //         .wait(200)
    //         .get("[data-testid='draggable']")
    //         .trigger("pointerdown", 50, 50, { force: true })

    //     cy.window()
    //         .trigger("pointermove", 60, 50, { force: true }) // Gesture will start from first move past threshold
    //         .wait(100)
    //         .trigger("pointermove", 200, 0, { force: true })
    //         .wait(50)
    //         // .trigger("pointermove", 200, 200, { force: true })
    //         // .wait(50)
    //         .trigger("pointerup", { force: true })
    //     cy.get("[data-testid='draggable']").should(($draggable: any) => {
    //         const draggable = $draggable[0] as HTMLDivElement
    //         const { left, top } = draggable.getBoundingClientRect()

    //         expect(left).to.equal(170)
    //         expect(top).to.equal(30)
    //     })
    // })

    // it("Direction locks to y", () => {
    //     cy.visit("?test=drag-svg&lock=true")
    //         .get("[data-testid='draggable']")
    //         .wait(200)
    //         .trigger("pointerdown", 50, 50, { force: true })
    //         .trigger("pointermove", 50, 60, { force: true }) // Gesture will start from first move past threshold
    //         .wait(200)
    //         .trigger("pointermove", 50, 200, { force: true })
    //         .wait(50)
    //         .trigger("pointermove", 200, 50, { force: true })
    //         .wait(50)
    //         .trigger("pointerup", { force: true })
    //         .should(($draggable: any) => {
    //             const draggable = $draggable[0] as HTMLDivElement
    //             const { left, top } = draggable.getBoundingClientRect()

    //             expect(left).to.equal(30)
    //             expect(top).to.equal(270)
    //         })
    // })

    it("Constraints as object: bottom right", () => {
        cy.visit("?test=drag-svg&right=100&bottom=100")
            .wait(200)
            .get("[data-testid='draggable']")
            .wait(100)
            .trigger("pointerdown", 50, 50, { force: true })
            .trigger("pointermove", 60, 60, { force: true }) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 200, 200, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(130)
                expect(top).to.equal(130)
            })
    })

    it("Constraints as object: top left", () => {
        cy.visit("?test=drag-svg&left=-10&top=-10")
            .wait(200)
            .get("[data-testid='draggable']")
            .wait(100)
            .trigger("pointerdown", 50, 50, { force: true })
            .trigger("pointermove", 60, 60, { force: true }) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 10, 10, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(20)
                expect(top).to.equal(20)
            })
    })
})

describe("Drag SVG & Layout", () => {
    it("Drags the element by the defined distance", () => {
        cy.visit("?test=drag-svg&layout=true")
            .get("[data-testid='draggable']")
            .wait(50)
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(30)
                expect(top).to.equal(30)
            })
            .wait(50)
            .trigger("pointerdown", 50, 50, { force: true })
            .trigger("pointermove", 60, 60, { force: true }) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 200, 300, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(190)
                expect(top).to.equal(290)
            })
    })

    it("Locks drag to x", () => {
        cy.visit("?test=drag-svg&axis=x&layout=true")
            .wait(200)
            .get("[data-testid='draggable']")
            .wait(200)
            .trigger("pointerdown", 50, 50, { force: true })
            .wait(50)
            .trigger("pointermove", 60, 60, { force: true }) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 200, 300, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(190)
                expect(top).to.equal(30)
            })
    })

    it("Locks drag to y", () => {
        cy.visit("?test=drag-svg&axis=y&layout=true")
            .wait(200)
            .get("[data-testid='draggable']")
            .wait(200)
            .trigger("pointerdown", 50, 50, { force: true })
            .wait(50)
            .trigger("pointermove", 60, 60, { force: true }) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 200, 300, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(30)
                expect(top).to.equal(290)
            })
    })

    // TODO: Figure out direction lock tests in Cypress
    // it("Direction locks to x", () => {
    //     cy.visit("?test=drag-svg&lock=true")
    //         .wait(200)
    //         .get("[data-testid='draggable']")
    //         .trigger("pointerdown", 50, 50, { force: true })

    //     cy.window()
    //         .trigger("pointermove", 60, 50, { force: true }) // Gesture will start from first move past threshold
    //         .wait(100)
    //         .trigger("pointermove", 200, 0, { force: true })
    //         .wait(50)
    //         // .trigger("pointermove", 200, 200, { force: true })
    //         // .wait(50)
    //         .trigger("pointerup", { force: true })
    //     cy.get("[data-testid='draggable']").should(($draggable: any) => {
    //         const draggable = $draggable[0] as HTMLDivElement
    //         const { left, top } = draggable.getBoundingClientRect()

    //         expect(left).to.equal(170)
    //         expect(top).to.equal(30)
    //     })
    // })

    // it("Direction locks to y", () => {
    //     cy.visit("?test=drag-svg&lock=true")
    //         .get("[data-testid='draggable']")
    //         .wait(200)
    //         .trigger("pointerdown", 50, 50, { force: true })
    //         .trigger("pointermove", 50, 60, { force: true }) // Gesture will start from first move past threshold
    //         .wait(200)
    //         .trigger("pointermove", 50, 200, { force: true })
    //         .wait(50)
    //         .trigger("pointermove", 200, 50, { force: true })
    //         .wait(50)
    //         .trigger("pointerup", { force: true })
    //         .should(($draggable: any) => {
    //             const draggable = $draggable[0] as HTMLDivElement
    //             const { left, top } = draggable.getBoundingClientRect()

    //             expect(left).to.equal(30)
    //             expect(top).to.equal(270)
    //         })
    // })

    it("Constraints as object: bottom right", () => {
        cy.visit("?test=drag-svg&right=100&bottom=100&layout=true")
            .wait(200)
            .get("[data-testid='draggable']")
            .wait(200)
            .trigger("pointerdown", 50, 50, { force: true })
            .trigger("pointermove", 60, 60, { force: true }) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 200, 200, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(130)
                expect(top).to.equal(130)
            })
    })

    it("Constraints as object: top left", () => {
        cy.visit("?test=drag-svg&left=-10&top=-10&layout=true")
            .wait(200)
            .get("[data-testid='draggable']")
            .wait(200)
            .trigger("pointerdown", 50, 50, { force: true })
            .trigger("pointermove", 60, 60, { force: true }) // Gesture will start from first move past threshold
            .wait(50)
            .trigger("pointermove", 10, 10, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                expect(left).to.equal(20)
                expect(top).to.equal(20)
            })
    })
})
