describe("useAnimationComplete", () => {
    it("fires callback when parent animation completes with correct position", () => {
        cy.visit("?test=use-animation-complete")
            .wait(1000)
            .get("#completed-offset")
            .should(([$el]) => {
                const offset = parseFloat($el.getAttribute("data-offset")!)
                // After animation completes, offset should reflect the final
                // resting position (x: 0), so it should equal the padding (40 + 40 = 80)
                expect(offset).to.equal(80)
            })
    })

    it("initial offset differs from completed offset due to mid-animation transform", () => {
        cy.visit("?test=use-animation-complete")
            .wait(1000)
            .get("#initial-offset")
            .should(([$el]) => {
                const initialOffset = parseFloat(
                    $el.getAttribute("data-offset")!
                )
                // Initial offset is measured during animation (x: 300),
                // so it should be larger than the final resting position
                expect(initialOffset).to.be.greaterThan(80)
            })
            .get("#completed-offset")
            .should(([$el]) => {
                const completedOffset = parseFloat(
                    $el.getAttribute("data-offset")!
                )
                // Completed offset is measured after animation, at the resting position
                expect(completedOffset).to.equal(80)
            })
    })
})
