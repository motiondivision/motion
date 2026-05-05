describe("animation.cancel() reverts to first keyframe", () => {
    it("Reverts to value at start of animation, preserving prior persisted state", () => {
        cy.visit("?test=animate-cancel-reverts-to-keyframe")
            .wait(3000)
            .get("#box")
            .then(($el) => {
                const text = $el.text()
                expect(text).to.equal("success")
            })
    })
})
