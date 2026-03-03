/**
 * Regression test for:
 * https://github.com/motiondivision/motion/issues/3401
 *
 * Bug: Layout animation breaks when an element has x: "100%" (percentage) and
 * a sibling is added before the entrance animation's keyframes are resolved.
 *
 * The projection system calls transformBox(targetWithTransforms, latestValues)
 * which previously couldn't handle percentage strings, producing NaN and causing
 * the element to teleport to its natural DOM position instead of layout-animating.
 */
describe("Layout animation: percentage x in flex container", () => {
    it("Correctly layout-animates when sibling added before keyframes resolve", () => {
        cy.visit("?test=layout-percent-x-flex")
            .get("#add")
            // Click twice rapidly — second click fires before the entrance
            // animation's keyframes (x: "100%") are resolved to pixels by
            // DOMKeyframesResolver. This triggers the layout update while
            // latestValues.x is still the string "100%".
            .click()
            .click()
            // Wait long enough for the x entrance animation (0.1s) to finish,
            // but short enough that the layout animation (10s) is still running.
            .wait(300)
            .get("#item-0")
            .should(([$item]: any) => {
                // If the layout animation is running, framer-motion applies a
                // non-identity CSS transform to item-0 to animate it from its
                // old position toward its new position.
                //
                // If the bug occurred (teleport), the layout animation was never
                // started, so after the entrance animation finishes (x=0) the
                // transform would be "none" — the item snapped instantly to its
                // natural DOM position.
                const transform = $item.style.transform
                expect(transform).to.not.equal("none")
                expect(transform).to.not.equal("")
            })
    })
})
