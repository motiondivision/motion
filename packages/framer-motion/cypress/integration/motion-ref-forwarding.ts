describe("Motion ref forwarding", () => {
    it("RefObject receives the DOM element", () => {
        cy.visit("?test=motion-ref-forwarding")
            .wait(100)
            .get("#ref-object-target")
            .should("exist")
            .get("#check-ref")
            .click()
            .wait(50)
            .get("#ref-object-value")
            .should("have.attr", "data-value", "DIV")
    })

    it("Callback ref is called with element on mount", () => {
        cy.visit("?test=motion-ref-forwarding")
            .wait(100)
            .get("#callback-mount-called")
            .should("have.attr", "data-value", "true")
            .get("#callback-mount-value")
            .should("have.attr", "data-value", "DIV")
    })

    it("Callback ref is called on unmount", () => {
        cy.visit("?test=motion-ref-forwarding")
            .wait(100)
            // Unmount the components
            .get("#toggle")
            .click()
            .wait(100)
            // Verify callback ref was called with null on unmount
            .get("#callback-unmount-called")
            .should("have.attr", "data-value", "true")
    })
})
