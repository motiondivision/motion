/**
 * Tests for Reorder auto-scroll feature.
 * Verifies that when dragging a reorder item near the edge of a scrollable
 * container, the container automatically scrolls.
 */
describe("Reorder auto-scroll", () => {
    it("Auto-scrolls down when dragging near bottom edge", () => {
        cy.visit("?test=reorder-auto-scroll")
            .wait(200)
            .get("[data-testid='scroll-container']")
            .then(($container) => {
                const container = $container[0]
                expect(container.scrollTop).to.equal(0)
            })
            .get("[data-testid='0']")
            .then(() => {
                cy.get("[data-testid='scroll-container']").then(($container) => {
                    const containerRect = $container[0].getBoundingClientRect()
                    const nearBottom = containerRect.bottom - containerRect.top - 20

                    cy.get("[data-testid='0']")
                        .trigger("pointerdown", 50, 25)
                        .wait(50)
                        .trigger("pointermove", 50, 30, { force: true })
                        .wait(50)
                        .trigger("pointermove", 50, nearBottom, { force: true })
                        .wait(300)
                        .get("[data-testid='scroll-container']")
                        .then(($c) => {
                            expect($c[0].scrollTop).to.be.greaterThan(0)
                        })
                        .get("[data-testid='0']")
                        .trigger("pointerup", { force: true })
                })
            })
    })

    it("Auto-scrolls up when dragging near top edge", () => {
        cy.visit("?test=reorder-auto-scroll")
            .wait(200)
            .get("[data-testid='scroll-container']")
            .then(($container) => {
                $container[0].scrollTop = 200
            })
            .wait(100)
            .get("[data-testid='scroll-container']")
            .should(($container) => {
                expect($container[0].scrollTop).to.equal(200)
            })
            .get("[data-testid='8']")
            .trigger("pointerdown", 50, 25)
            .wait(50)
            .trigger("pointermove", 50, 20, { force: true })
            .wait(50)
            .trigger("pointermove", 50, -100, { force: true })
            .wait(300)
            .get("[data-testid='scroll-container']")
            .then(($container) => {
                expect($container[0].scrollTop).to.be.lessThan(200)
            })
            .get("[data-testid='8']")
            .trigger("pointerup", { force: true })
    })
})
