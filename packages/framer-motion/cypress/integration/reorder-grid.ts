describe("Reorder grid", () => {
    it("auto-detects a grid and reorders across both axes", () => {
        cy.visit("?test=reorder-grid").wait(200)

        cy.get("[data-testid='a']")
            .trigger("pointerdown", 50, 50, { force: true })
            .wait(50)
            .trigger("pointermove", 60, 60, { force: true })
            .wait(50)
            .trigger("pointermove", 160, 160, { force: true })
            .wait(100)

        cy.get("[data-testid='current-order']").then(($order) => {
            expect($order.text()).to.equal("b,c,d,a")
        })

        cy.get("[data-testid='a']").trigger("pointerup", 160, 160, {
            force: true,
        })
    })
})
