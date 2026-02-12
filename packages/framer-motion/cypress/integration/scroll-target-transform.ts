describe("useScroll with target does not set accelerate", () => {
    it("Does not set accelerate when target is provided", () => {
        cy.visit("?test=scroll-target-transform")
            .wait(200)
            .get("#has-accelerate")
            .should(([$el]: any) => {
                expect($el.innerText).to.equal("false")
            })
    })

    it("Opacity updates via useTransform when scrolling", () => {
        cy.visit("?test=scroll-target-transform")
            .wait(200)
            .get("#target")
            .should(([$el]: any) => {
                // Before scrolling, opacity should be near initial value
                const initialOpacity = parseFloat(
                    getComputedStyle($el).opacity
                )
                expect(initialOpacity).to.be.greaterThan(0)
            })
        cy.scrollTo("bottom", { duration: 300 })
            .wait(200)
            .get("#target")
            .should(([$el]: any) => {
                // After scrolling, opacity should have changed
                const opacity = parseFloat(getComputedStyle($el).opacity)
                expect(opacity).to.be.lessThan(1)
            })
    })
})
