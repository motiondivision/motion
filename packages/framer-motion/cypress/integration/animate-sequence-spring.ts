describe("animate() sequence with spring defaultTransition (#3158)", () => {
    it("does not throw when using type: spring with 2-keyframe sequence segments", () => {
        cy.visit("?test=animate-sequence-spring")
            .wait(2000)
            .get("#result")
            .should(($el: any) => {
                expect($el.val()).to.equal("Success")
            })
    })
})
