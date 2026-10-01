/**
 * A zero-duration animation reports completion before the frame that
 * applies its value, so wait for that frame instead.
 */
const nextFrame = () =>
    cy
        .window()
        .then(
            (win) =>
                new Cypress.Promise<void>((resolve) =>
                    win.requestAnimationFrame(() => resolve())
                )
        )

describe("waapi-svg-zero-duration", () => {
    it("Restores SVG opacity with a zero-duration animation", () => {
        cy.visit("?test=waapi-svg-zero-duration")
            .get("#toggle")
            .click()
            .get('#chip[data-complete="hidden"]')
            .then(([$chip]: any) => {
                expect(getComputedStyle($chip).opacity).to.equal("0")
            })
            .get("#toggle")
            .click()
        nextFrame()
            .get("#chip")
            .then(([$chip]: any) => {
                expect(getComputedStyle($chip).opacity).to.equal("1")
            })
    })

    it("Restores SVG transform with a zero-duration animation", () => {
        cy.visit("?test=waapi-svg-zero-duration")
            .get("#toggle")
            .click()
            .get('#transform-target[data-complete="hidden"]')
            .then(([$target]: any) => {
                expect($target.style.transform).to.equal("translateX(50px)")
            })
            .get("#toggle")
            .click()
        nextFrame()
            .get("#transform-target")
            .then(([$target]: any) => {
                expect($target.style.transform).to.equal("translateX(0px)")
            })
    })
})
