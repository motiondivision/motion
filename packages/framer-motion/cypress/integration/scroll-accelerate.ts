describe("scroll timeline WAAPI acceleration", () => {
    it("Creates WAAPI animation for accelerated property, not for non-accelerated", () => {
        cy.visit("?test=scroll-accelerate")
            .wait(200)
            .get("#direct-count")
            .should(([$el]: any) => {
                // opacity is acceleratable, backgroundColor is not → 1 animation
                expect($el.innerText).to.equal("1")
            })
    })

    it("Does not create WAAPI animation for chained useTransform", () => {
        cy.visit("?test=scroll-accelerate")
            .wait(200)
            .get("#chained-count")
            .should(([$el]: any) => {
                // Chained useTransform should NOT accelerate
                expect($el.innerText).to.equal("0")
            })
    })
})
