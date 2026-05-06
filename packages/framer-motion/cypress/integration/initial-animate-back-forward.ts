/**
 * Regression coverage for #3676. The reporter's repro is a hard URL-bar
 * navigation followed by browser back/forward, which in dev mode leaves
 * `motion.div` stuck at opacity:0. Cypress (Electron) does not exercise
 * Chrome's BFCache, so this spec validates the desired outcome — the
 * animation must reach opacity:1 — rather than directly reproducing the
 * paused-mid-flight scenario only Chrome with BFCache demonstrates.
 */
describe("initial → animate after browser back/forward (#3676)", () => {
    it("animates to opacity 1 after navigating away and pressing back", () => {
        cy.visit("?test=initial-animate-back-forward")
            .wait(800)
            .get("#box")
            .should(($el: any) => {
                const opacity = parseFloat(
                    window.getComputedStyle($el[0]).opacity
                )
                expect(opacity).to.equal(1)
            })

        cy.visit("?test=initial-animate-back-forward-other")
            .wait(200)
            .get("#other-page")
            .should("exist")

        cy.go("back")
            .wait(800)
            .get("#box")
            .should(($el: any) => {
                const opacity = parseFloat(
                    window.getComputedStyle($el[0]).opacity
                )
                expect(opacity).to.equal(1)
            })
    })

    it("animates to opacity 1 after navigating away mid-animation and pressing back", () => {
        cy.visit("?test=initial-animate-back-forward")
            .wait(100)
            .get("#box")
            .should("exist")

        cy.visit("?test=initial-animate-back-forward-other")
            .wait(200)
            .get("#other-page")
            .should("exist")

        cy.go("back")
            .wait(800)
            .get("#box")
            .should(($el: any) => {
                const opacity = parseFloat(
                    window.getComputedStyle($el[0]).opacity
                )
                expect(opacity).to.equal(1)
            })
    })

    it("animates to opacity 1 after pressing back then forward", () => {
        cy.visit("?test=initial-animate-back-forward")
            .wait(800)
            .get("#box")
            .should("exist")

        cy.visit("?test=initial-animate-back-forward-other")
            .wait(200)
            .get("#other-page")
            .should("exist")

        cy.go("back").wait(200).get("#box").should("exist")

        cy.go("forward")
            .wait(200)
            .get("#other-page")
            .should("exist")

        cy.go("back")
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
