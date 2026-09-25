interface BoundingBox {
    top: number
    left: number
    width: number
    height: number
}

function expectBbox(element: HTMLElement, expectedBbox: BoundingBox) {
    const bbox = element.getBoundingClientRect()
    /**
     * Using within as this test is measuring differently on different Mac screens
     */
    expect(bbox.left).to.be.within(expectedBbox.left - 2, expectedBbox.left + 2)
    expect(bbox.top).to.be.within(expectedBbox.top - 2, expectedBbox.top + 2)
    expect(bbox.width).to.be.within(
        expectedBbox.width - 2,
        expectedBbox.width + 2
    )
    expect(bbox.height).to.be.within(
        expectedBbox.height - 2,
        expectedBbox.height + 2
    )
}

describe("Drag to reorder", () => {
    it("Y axis", () => {
        cy.visit("?test=drag-to-reorder")
            .wait(50)
            .get("#Tomato")
            .should(([$item]: any) => {
                expectBbox($item, {
                    height: 68,
                    left: 350,
                    top: 174,
                    width: 340,
                })
            })
            .get("#Cucumber")
            .should(([$item]: any) => {
                expectBbox($item, {
                    height: 68,
                    left: 350,
                    top: 253,
                    width: 340,
                })
            })
            .get("#Tomato")
            .trigger("pointerdown", 360, 175, { force: true })
            .wait(50)
            .trigger("pointermove", 360, 180, { force: true })
            .wait(50)
            .trigger("pointermove", 360, 200, { force: true })
            .wait(50)
            .trigger("pointermove", 360, 220, { force: true })
            .wait(100)
            .should(([$item]: any) => {
                expectBbox($item, {
                    height: 68,
                    left: 350,
                    top: 249,
                    width: 340,
                })
            })
            .get("#Cucumber")
            .should(([$item]: any) => {
                expectBbox($item, {
                    height: 68,
                    left: 350,
                    top: 174,
                    width: 340,
                })
            })
            .get("#Tomato")
            .trigger("pointerup", 360, 220, { force: true })
            .wait(100)
            .should(([$item]: any) => {
                expectBbox($item, {
                    height: 68,
                    left: 350,
                    top: 252,
                    width: 340,
                })
            })
            .get("#Cucumber")
            .trigger("pointerdown", 360, 175, { force: true })
            .wait(50)
            .trigger("pointermove", 360, 180, { force: true })
            .wait(50)
            .trigger("pointermove", 360, 200, { force: true })
            .wait(50)
            .trigger("pointermove", 360, 220, { force: true })
            .wait(100)
            .should(([$item]: any) => {
                expectBbox($item, {
                    height: 68,
                    left: 350,
                    top: 249,
                    width: 340,
                })
            })
            .trigger("pointerup", 360, 220, { force: true })
            .get("#Tomato")
            .should(([$item]: any) => {
                expectBbox($item, {
                    height: 68,
                    left: 350,
                    top: 175,
                    width: 340,
                })
            })
            .trigger("pointerdown", 360, 0, { force: true })
            .wait(100)
            .trigger("pointermove", 360, -100, { force: true })
            .wait(100)
            .trigger("pointerup", 360, -100, { force: true })
            .wait(20)
            .trigger("pointerdown", 360, -100, { force: true })
            .wait(50)
            .trigger("pointerup", 360, -100, { force: true })
            .wait(100)
            .get("#Tomato")
            .should(([$item]: any) => {
                expectBbox($item, {
                    height: 68,
                    left: 350,
                    top: 176,
                    width: 340,
                })
            })
    })

    it("X axis", () => {
        cy.visit("?test=drag-to-reorder&axis=x")
            .wait(50)
            .get("#Tomato")
            .should(([$item]: any) => {
                expectBbox($item, {
                    height: 68,
                    left: 350,
                    top: 291,
                    width: 340,
                })
            })
            .get("#Cucumber")
            .should(([$item]: any) => {
                expectBbox($item, {
                    height: 68,
                    left: 690,
                    top: 291,
                    width: 340,
                })
            })
            .get("#Tomato")
            .trigger("pointerdown", 360, 175, { force: true })
            .wait(50)
            .trigger("pointermove", 365, 175, { force: true })
            .wait(50)
            .trigger("pointermove", 425, 175, { force: true })
            .wait(50)
            .trigger("pointermove", 475, 175, { force: true })
            .wait(100)
            .should(([$item]: any) => {
                expectBbox($item, {
                    height: 68,
                    left: 535,
                    top: 291,
                    width: 340,
                })
            })
            .get("#Cucumber")
            .should(([$item]: any) => {
                expectBbox($item, {
                    height: 68,
                    left: 350,
                    top: 291,
                    width: 340,
                })
            })
    })

    it("Move around", () => {
        const checkBox = (chain: Cypress.Chainable) => {
            return chain.should(([$item]: any) => {
                expectBbox($item, {
                    height: 68,
                    left: 350,
                    top: 174,
                    width: 340,
                })
            })
        }

        const moveAround = (chain: Cypress.Chainable, steps: number[]) => {
            const baseY = 175
            const delta = 20
            chain = chain
                .trigger("pointerdown", 360, baseY, { force: true })
                .wait(150)

            steps.forEach((step) => {
                Array.from({ length: Math.abs(step) }).forEach(() => {
                    const y = step > 0 ? delta : -delta
                    chain = chain
                        .trigger("pointermove", 360, baseY + y, { force: true })
                        .wait(150)
                })
            })
            return chain
                .trigger("pointerup", 360, baseY, { force: true })
                .wait(150)
        }

        const chain = checkBox(
            cy.visit("?test=drag-to-reorder").wait(50).get("#Tomato")
        )

        /**
         * Re-query so the check retries: the snap back to origin needs two
         * frames after release, which slow CI can take longer than
         * moveAround's 150ms wait to produce.
         */
        checkBox(moveAround(chain, [-4, 14, -8, 4, -5, 2, -6]).get("#Tomato"))
    })
})
