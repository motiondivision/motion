describe("StrictMode opacity animation", () => {
    it("element starts at opacity 0 when using single 'to' value with autoplay: false", () => {
        cy.visit("?test=strict-mode-opacity")
            .wait(200)
            .get("#box")
            .should(($el: any) => {
                const opacity = parseFloat(
                    window.getComputedStyle($el[0]).opacity
                )
                expect(opacity).to.equal(0)
            })
    })

    it("element animates to opacity 1 when triggered", () => {
        cy.visit("?test=strict-mode-opacity")
            .wait(200)
            .get("#box")
            .should(($el: any) => {
                const opacity = parseFloat(
                    window.getComputedStyle($el[0]).opacity
                )
                expect(opacity).to.equal(0)
            })
            .get("#trigger")
            .click()
            .wait(800)
            .get("#box")
            .should(($el: any) => {
                const opacity = parseFloat(
                    window.getComputedStyle($el[0]).opacity
                )
                expect(opacity).to.equal(1)
            })
    })
})
