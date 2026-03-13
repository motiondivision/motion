describe("whileInView remount (#3079)", () => {
    it("Triggers whileInView on initial mount", () => {
        cy.visit("?test=while-in-view-remount")
            .wait(100)
            .get("#go-projects")
            .click()
            .wait(200)
            .get("#card1")
            .should(($el: any) => {
                // Element should be visible (opacity 1) after mount
                const opacity = parseFloat(
                    getComputedStyle($el[0]).opacity
                )
                expect(opacity).to.equal(1)
            })
    })

    it("Triggers whileInView after remount (soft navigation)", () => {
        // Start on projects page
        cy.visit("?test=while-in-view-remount")
            .wait(100)
            .get("#go-projects")
            .click()
            .wait(200)
            .get("#card1")
            .should(($el: any) => {
                const opacity = parseFloat(
                    getComputedStyle($el[0]).opacity
                )
                expect(opacity).to.equal(1)
            })

        // Navigate away (unmount)
        cy.get("#go-home").click().wait(100)

        // Navigate back (remount - simulates soft navigation)
        cy.get("#go-projects").click().wait(200)

        // Cards should animate again
        cy.get("#card1").should(($el: any) => {
            const opacity = parseFloat(
                getComputedStyle($el[0]).opacity
            )
            expect(opacity).to.equal(1)
        })
        cy.get("#card2").should(($el: any) => {
            const opacity = parseFloat(
                getComputedStyle($el[0]).opacity
            )
            expect(opacity).to.equal(1)
        })
    })

    it("Fires onViewportEnter after remount", () => {
        // Start on projects page
        cy.visit("?test=while-in-view-remount")
            .wait(100)
            .get("#go-projects")
            .click()
            .wait(200)
            .get("#card1")
            .should(($el: any) => {
                expect($el[0].dataset.inView).to.equal("true")
            })

        // Navigate away
        cy.get("#go-home").click().wait(100)

        // Navigate back (remount)
        cy.get("#go-projects").click().wait(200)

        // onViewportEnter should fire again
        cy.get("#card1").should(($el: any) => {
            expect($el[0].dataset.inView).to.equal("true")
        })
    })
})
