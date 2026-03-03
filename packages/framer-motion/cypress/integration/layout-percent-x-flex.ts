/**
 * Regression test for:
 * https://github.com/motiondivision/motion/issues/3401
 *
 * Bug: layout animation breaks when x: "100%" (percentage) is in latestValues
 * at the moment the layout update fires.
 *
 * The test page replicates the sandbox pattern:
 *   - Only the most-recently-added item has initial/animate props (shouldAnimate)
 *   - When a new item is added, shouldAnimate flips false for the previous item
 *     → its x animation stops and latestValues.x stays at "100%"
 *   - The subsequent layout update fires with latestValues.x = "100%"
 *   - Before the fix, transformBox produced NaN → projection identity →
 *     element teleported to its natural DOM position (no correction transform)
 */
describe("Layout animation: percentage x in flex container", () => {
    it("Correctly layout-animates when sibling added before keyframes resolve", () => {
        cy.visit("?test=layout-percent-x-flex")
            .get("#add")
            // First click: item-2 is added with initial={{ x: "100%" }},
            // animate={{ x: 0 }}, latestValues.x = "100%"
            .click()
            // Second click: item-3 is added, shouldAnimate flips false for
            // item-2 → its animate prop is removed → x animation stops →
            // latestValues.x stays at "100%". Layout update fires immediately.
            .click()
            .wait(300)
            .get("#item-2")
            .should(([$item]: any) => {
                // If the layout animation is running correctly, framer-motion
                // applies a non-identity CSS transform to item-2 (the layout
                // correction that accounts for x: "100%" in latestValues).
                //
                // If the bug occurred, transformBox produced NaN → projection
                // delta was forced to identity → no correction transform →
                // item-2 snapped to its natural DOM position immediately.
                // After snapping, with no animate prop, the transform stays "none".
                const transform = $item.style.transform
                expect(transform).to.not.equal("none")
                expect(transform).to.not.equal("")
            })
    })
})
