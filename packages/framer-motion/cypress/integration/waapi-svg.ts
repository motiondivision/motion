/**
 * Two complementary tests, each gated on Element.getAnimations() support:
 *
 * - Browsers without it (CI's Electron) run a behavioral check: when an
 *   animation is hardware-accelerated, Motion doesn't run its JS animation
 *   loop, so the values it renders per-frame (SVG attributes, inline styles)
 *   stay at their initial keyframe while the computed style animates. The JS
 *   fallback writes these values every frame, so asserting they're static
 *   mid-animation proves WAAPI is driving the animation.
 *
 * - Browsers with it verify WAAPI animations directly. (The behavioral check
 *   can't run there: Cypress's runner starves the AUT iframe of rendering
 *   frames in modern Chrome, so animation timelines barely advance.)
 */

const parseMatrix = (computedTransform: string) =>
    computedTransform
        .replace(/matrix\(|\)/g, "")
        .split(",")
        .map(parseFloat)

describe("waapi-svg", () => {
    it("Drives SVG opacity and transform animations with WAAPI, not per-frame renders", function () {
        cy.visit("?test=waapi-svg").wait(1000)
        cy.window().then((win: any) => {
            if (win.Element.prototype.getAnimations) return this.skip()

            /**
             * Sanity check: the HTML control element is accelerated,
             * proving the WAAPI path works in this environment.
             */
            cy.get("#control").then(([$control]: any) => {
                const opacity = parseFloat(getComputedStyle($control).opacity)
                expect(opacity).to.be.lessThan(0.97)
                expect(opacity).to.be.greaterThan(0.25)
                expect($control.style.opacity).to.equal("1")
                expect($control.style.transform).to.equal("translateX(0px)")
            })
            cy.get("#circle").then(([$circle]: any) => {
                const computed = getComputedStyle($circle)
                const opacity = parseFloat(computed.opacity)
                expect(opacity).to.be.lessThan(0.97)
                expect(opacity).to.be.greaterThan(0.25)

                const [, , , , translateX] = parseMatrix(computed.transform)
                expect(translateX).to.be.greaterThan(3)

                // Per-frame rendered values remain at the initial keyframe
                expect($circle.style.opacity).to.equal("1")
                expect($circle.style.transform).to.equal("translateX(0px)")
            })
            cy.get("#rect").then(([$rect]: any) => {
                const computed = getComputedStyle($rect)
                const opacity = parseFloat(computed.opacity)
                expect(opacity).to.be.lessThan(0.97)
                expect(opacity).to.be.greaterThan(0.25)

                const [scaleX] = parseMatrix(computed.transform)
                expect(scaleX).to.be.greaterThan(1.01)

                expect($rect.style.opacity).to.equal("1")
                expect($rect.style.transform).to.equal("scale(1)")
            })
        })
    })

    it("Creates WAAPI animations on SVG elements (requires getAnimations support)", function () {
        cy.visit("?test=waapi-svg").wait(200)
        cy.window().then((win: any) => {
            if (!win.Element.prototype.getAnimations) return this.skip()

            const getAnimatedProperties = (element: Element) =>
                element
                    .getAnimations()
                    .flatMap((animation) =>
                        Object.keys(
                            (
                                animation.effect as KeyframeEffect
                            ).getKeyframes()[0] ?? {}
                        )
                    )

            // .should() so we retry until the animations have been created
            cy.get("#circle").should(([$circle]: any) => {
                const properties = getAnimatedProperties($circle)
                expect(properties).to.include("opacity")
                expect(properties).to.include("transform")
            })
            cy.get("#rect").should(([$rect]: any) => {
                const properties = getAnimatedProperties($rect)
                expect(properties).to.include("opacity")
                expect(properties).to.include("transform")
            })
        })
    })
})
