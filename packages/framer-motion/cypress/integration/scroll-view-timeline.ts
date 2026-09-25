describe("scroll ViewTimeline acceleration", () => {
    it("Does NOT accelerate target with default offset", () => {
        cy.visit("?test=scroll-view-timeline")
            .wait(200)
            .get("#default-accelerate")
            .should(([$el]: any) => {
                expect($el.innerText).to.equal("false")
            })
    })

    it("Accelerates target with Enter preset offset when ViewTimeline supported", () => {
        cy.visit("?test=scroll-view-timeline")
            .wait(200)
            .get("#enter-accelerate")
            .should(([$el]: any) => {
                const expected = (window as any).ViewTimeline
                    ? "true"
                    : "false"
                expect($el.innerText).to.equal(expected)
            })
    })

    it("Accelerates target with cover string offset when ViewTimeline supported", () => {
        cy.visit("?test=scroll-view-timeline")
            .wait(200)
            .get("#string-accelerate")
            .should(([$el]: any) => {
                const expected = (window as any).ViewTimeline
                    ? "true"
                    : "false"
                expect($el.innerText).to.equal(expected)
            })
    })
})
