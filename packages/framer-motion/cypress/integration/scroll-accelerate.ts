describe("scroll timeline WAAPI acceleration", () => {
    it("Propagates acceleration for direct useTransform from scroll", () => {
        cy.visit("?test=scroll-accelerate")
            .wait(200)
            .get("#direct-accelerated")
            .should(([$el]: any) => {
                const expected = (window as any).ScrollTimeline
                    ? "true"
                    : "false"
                expect($el.innerText).to.equal(expected)
            })
    })

    it("Propagates acceleration for non-acceleratable properties too", () => {
        cy.visit("?test=scroll-accelerate")
            .wait(200)
            .get("#bg-accelerated")
            .should(([$el]: any) => {
                // backgroundColor gets accelerate config propagated,
                // but VisualElement skips WAAPI creation since it's
                // not in the acceleratedValues set
                const expected = (window as any).ScrollTimeline
                    ? "true"
                    : "false"
                expect($el.innerText).to.equal(expected)
            })
    })

    it("Does not propagate acceleration for chained useTransform", () => {
        cy.visit("?test=scroll-accelerate")
            .wait(200)
            .get("#chained-accelerated")
            .should(([$el]: any) => {
                expect($el.innerText).to.equal("false")
            })
    })
})
