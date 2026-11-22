describe("CSS appear", () => {
    let midway = 0

    it("runs an enter animation as CSS, then leaves the element as it is without", () => {
        cy.visit("?test=appear-css")
            .wait(1000)
            .get("#box")
            .then(([$element]: any) => {
                /**
                 * A browser without the CSS these are made of animates
                 * as it does without the config.
                 */
                if (
                    CSS.supports("translate", "0") &&
                    CSS.supports("animation-timing-function", "linear(0,1)")
                ) {
                    const names = $element
                        .getAnimations()
                        .map((animation: any) => animation.animationName)

                    // Opacity, translate, and a hold of the transform style
                    expect(names).to.include("m-opacity")
                    expect(names).to.include("m-translate")
                    expect(names.length).to.equal(3)
                }

                const opacity = parseFloat(getComputedStyle($element).opacity)
                expect(opacity).to.be.greaterThan(0.3)
                expect(opacity).to.be.lessThan(0.7)

                midway = $element.getBoundingClientRect().left
            })
            .wait(1500)
            .then(([$element]: any) => {
                $element.getAnimations &&
                    expect($element.getAnimations().length).to.equal(0)
                expect($element.style.animation).to.equal("")
                expect(getComputedStyle($element).opacity).to.equal("1")

                // x was half of its 100px from its place
                const moved = $element.getBoundingClientRect().left - midway
                expect(moved).to.be.greaterThan(30)
                expect(moved).to.be.lessThan(70)
            })
    })
})
