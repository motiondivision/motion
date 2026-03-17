/**
 * Tests for #2949: SVG styles not applying on mount.
 *
 * The bug: SVG elements using useTransform-derived values would have
 * incorrect transformOrigin/transformBox on initial mount (before
 * dimensions are measured), causing a visible "jump" when the visual
 * element takes over.
 *
 * The fix: Always set transformBox to "fill-box" and transformOrigin
 * to "50% 50%" on SVG elements with transforms, even before dimensions
 * are measured.
 */
describe("SVG styles on mount (#2949)", () => {
    it("Applies transform, transformBox, and transformOrigin on mount", () => {
        cy.visit("?test=svg-style-on-mount")
            .get("#path")
            .then(([$path]: any) => {
                // Transform should be applied immediately on mount
                expect($path.style.transform).to.contain("translateX(10px)")
                expect($path.style.transform).to.contain("translateY(10px)")

                // transformBox must be "fill-box" on initial mount
                // (this was the core of the #2949 bug — it was missing)
                expect($path.style.transformBox).to.equal("fill-box")

                // transformOrigin must be set to prevent jumping
                expect($path.style.transformOrigin).to.equal("50% 50%")
            })
    })

    it("Applies useTransform-derived pathLength attributes on mount", () => {
        cy.visit("?test=svg-style-on-mount")
            .get("#path")
            .then(([$path]: any) => {
                // pathLength should be 0.5 (useTransform(50, [0,100], [0,1]))
                // buildSVGPath normalizes the pathLength attribute to 1
                expect($path.getAttribute("pathLength")).to.equal("1")

                // stroke-dasharray should reflect pathLength=0.5
                expect($path.getAttribute("stroke-dasharray")).to.equal(
                    "0.5 1"
                )

                // stroke-dashoffset should be 0 (pathOffset defaults to 0)
                const dashoffset = $path.getAttribute("stroke-dashoffset")
                expect(parseFloat(dashoffset)).to.equal(0)
            })
    })

    it("Applies useTransform-derived opacity on SVG path on mount", () => {
        cy.visit("?test=svg-style-on-mount")
            .get("#path")
            .then(([$path]: any) => {
                // opacity should be 0.5 (useTransform(50, [0,100], [0,1]))
                const opacity =
                    $path.getAttribute("opacity") ??
                    window.getComputedStyle($path).opacity
                expect(parseFloat(opacity)).to.equal(0.5)
            })
    })

    it("Applies useTransform-derived fill on SVG circle on mount", () => {
        cy.visit("?test=svg-style-on-mount")
            .get("#circle")
            .then(([$circle]: any) => {
                // fill should be interpolated (not null/empty/default)
                const fill = $circle.getAttribute("fill")
                expect(fill).to.not.be.null
                expect(fill).to.not.equal("")
            })
    })

    it("Applies transformBox and transformOrigin on SVG rect with static transform", () => {
        cy.visit("?test=svg-style-on-mount")
            .get("#rect")
            .then(([$rect]: any) => {
                expect($rect.style.transform).to.equal("rotate(45deg)")
                expect($rect.style.transformBox).to.equal("fill-box")
                expect($rect.style.transformOrigin).to.equal("50% 50%")
            })
    })
})
