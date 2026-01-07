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

    it("Callback ref cleanup is handled on unmount", () => {
        cy.visit("?test=motion-ref-forwarding")
            .wait(100)
            // Unmount the components
            .get("#toggle")
            .click()
            .wait(100)
            // Either cleanup function is called (React 19 pattern)
            // OR callback ref is called with null (React 18 pattern)
            .then(() => {
                cy.get("#callback-unmount-called").then(($unmount) => {
                    cy.get("#cleanup-called").then(($cleanup) => {
                        const unmountCalled =
                            $unmount.attr("data-value") === "true"
                        const cleanupCalled =
                            $cleanup.attr("data-value") === "true"
                        expect(
                            unmountCalled || cleanupCalled,
                            "Either unmount or cleanup should be called"
                        ).to.be.true
                    })
                })
            })
    })
})
