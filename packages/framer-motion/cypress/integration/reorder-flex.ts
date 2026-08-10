const drag = (x: number, y: number) => {
    cy.get("[data-testid='a']")
        .trigger("pointerdown", 40, 40, { force: true })
        .wait(50)
        .trigger("pointermove", 50, 50, { force: true })
        .wait(50)
        .trigger("pointermove", x, y, { force: true })
        .wait(100)
}

describe("Reorder flex layouts", () => {
    it("auto-detects a flex row", () => {
        cy.visit("?test=reorder-flex&layout=row").wait(200)
        drag(150, 40)
        cy.get("[data-testid='current-order']").should("have.text", "b,a,c,d")
    })

    it("auto-detects a flex column", () => {
        cy.visit("?test=reorder-flex&layout=column").wait(200)
        drag(40, 150)
        cy.get("[data-testid='current-order']").should("have.text", "b,a,c,d")
    })

    it("auto-detects wrapped flex rows", () => {
        cy.visit("?test=reorder-flex&layout=wrap").wait(200)
        drag(150, 150)
        cy.get("[data-testid='current-order']").should("have.text", "b,c,d,a")
    })

    it("auto-detects wrapped RTL flex rows", () => {
        cy.visit("?test=reorder-flex&layout=wrap-rtl").wait(200)
        drag(-70, 150)
        cy.get("[data-testid='current-order']").should("have.text", "b,c,d,a")
    })
})
