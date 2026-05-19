/**
 * Tests for the `path: arc()` transition modifier across both layout
 * animations (`transition.layout.path`) and keyframe animations
 * (`transition.path`).
 *
 * Layout-arc tests visit `?variant=freeze` (or `none`/`small`) which use
 * `ease: () => 0.5` to pin the layout animation at exactly 50% progress.
 * That lets us sample mid-arc position with `getBoundingClientRect()`
 * without fighting timing.
 *
 * The default `?test=transition-arc` URL auto-toggles with a real ease for
 * visual inspection — those URLs are not what these tests run against.
 */

describe("layout arc", () => {
    it("deviates from the straight-line path mid-animation", () => {
        cy.visit("?test=transition-arc&variant=freeze")
            .wait(50)
            .get("#indicator")
            .should(([$el]: any) => {
                expect($el.getBoundingClientRect().top).to.be.closeTo(200, 10)
            })
            .get("#toggle")
            .click()
            .wait(100)
            // 400px horizontal, amplitude=1 → ~200px perpendicular at t=0.5
            .get("#indicator")
            .should(([$el]: any) => {
                const { top } = $el.getBoundingClientRect()
                expect(Math.abs(top - 200)).to.be.greaterThan(80)
            })
    })

    it("stays on the straight-line path without arc config", () => {
        cy.visit("?test=transition-arc&variant=none")
            .wait(50)
            .get("#indicator")
            .should(([$el]: any) => {
                expect($el.getBoundingClientRect().top).to.be.closeTo(200, 10)
            })
            .get("#toggle")
            .click()
            .wait(100)
            .get("#indicator")
            .should(([$el]: any) => {
                expect($el.getBoundingClientRect().top).to.be.closeTo(200, 20)
            })
    })

    it("does not arc for movements below the 20px minimum distance", () => {
        cy.visit("?test=transition-arc&variant=small")
            .wait(50)
            .get("#indicator")
            .should(([$el]: any) => {
                expect($el.getBoundingClientRect().top).to.be.closeTo(200, 10)
            })
            .get("#toggle")
            .click()
            .wait(100)
            .get("#indicator")
            .should(([$el]: any) => {
                expect($el.getBoundingClientRect().top).to.be.closeTo(200, 20)
            })
    })
})

/**
 * Keyframe arc tests use `?freeze` to pin the animation at midpoint
 * (same trick as the layout tests). Click Toggle, wait for the layout
 * effect + animation start, then sample.
 */
describe("keyframe arc", () => {
    it("deflects y perpendicular while x interpolates", () => {
        cy.visit("?test=transition-arc&variant=keyframe&freeze")
            .wait(50)
            .get("#indicator")
            .should(([$el]: any) => {
                // Starts at top:200 with no x translation.
                const r = $el.getBoundingClientRect()
                expect(r.top).to.be.closeTo(200, 5)
                expect(r.left).to.be.closeTo(50, 5)
            })
            .get("#toggle")
            .click()
            .wait(100)
            .get("#indicator")
            .should(([$el]: any) => {
                // 400px horizontal, amplitude=1 → ~200px perpendicular at t=0.5.
                // Because the chord is horizontal and dx>0, auto-direction
                // bulges +y (downward in screen space).
                const r = $el.getBoundingClientRect()
                expect(r.left, "x is roughly midway").to.be.closeTo(50 + 200, 25)
                expect(
                    Math.abs(r.top - 200),
                    "y has deflected ~200px from baseline"
                ).to.be.greaterThan(150)
            })
    })

    it("orientToPath rotates the element along the curve", () => {
        // freezeAt=0.25: at t=0.25 the bezier tangent has clearly diverged
        // from the baseline tangent so rotation is non-zero. (At t=0.5 it
        // crosses zero by symmetry — see KeyframeArc comments.)
        cy.visit("?test=transition-arc&variant=oriented&freezeAt=0.25")
            .wait(50)
            .get("#toggle")
            .click()
            .wait(100)
            .get("#indicator")
            .should(([$el]: any) => {
                const t = window.getComputedStyle($el).transform
                expect(t, "expected a transform matrix").to.match(/matrix/)
                const m = t.match(/matrix\(([^)]+)\)/)
                if (!m) throw new Error(`unexpected transform: ${t}`)
                // matrix(a, b, c, d, tx, ty). For a pure translate, a=1, b=0.
                // For rotation, |b| > 0 and a < 1.
                const [a, b] = m[1].split(",").map((v) => parseFloat(v))
                expect(
                    Math.abs(b),
                    "y-shear of matrix is non-zero (rotated)"
                ).to.be.greaterThan(0.05)
                expect(a, "x-scale is less than 1 (rotated)").to.be.lessThan(1)
            })
    })

    it("no orientToPath leaves rotation untouched", () => {
        cy.visit("?test=transition-arc&variant=keyframe&freeze")
            .wait(50)
            .get("#toggle")
            .click()
            .wait(100)
            .get("#indicator")
            .should(([$el]: any) => {
                const t = window.getComputedStyle($el).transform
                const m = t.match(/matrix\(([^)]+)\)/)
                if (!m) return
                const [a, b] = m[1].split(",").map((v) => parseFloat(v))
                // Pure translate: a=1, b=0. Allow tiny float fuzz.
                expect(a).to.be.closeTo(1, 0.01)
                expect(Math.abs(b)).to.be.lessThan(0.01)
            })
    })
})

/**
 * An oriented arc running concurrently with a user `rotate` animation.
 * `pathRotation` is composed onto the user's `rotate` at the build site,
 * so the user's value must never be read or clobbered.
 *
 * Frozen at t=0.5: pathRotation ~0 by symmetry, x ~mid, and `rotate`
 * (0 → 90, eased 0.5) ~45deg. The old clobbering behaviour would leave
 * rotation at ~0deg instead.
 */
describe("arc composes with concurrent rotate", () => {
    it("does not clobber a user rotate animation", () => {
        cy.visit("?test=transition-arc&variant=rotate-compose")
            .wait(50)
            .get("#toggle")
            .click()
            .wait(100)
            .get("#indicator")
            .should(([$el]: any) => {
                const t = window.getComputedStyle($el).transform
                const m = t.match(/matrix\(([^)]+)\)/)
                if (!m) throw new Error(`expected a matrix, got: ${t}`)
                const [a, b, , , tx] = m[1]
                    .split(",")
                    .map((v) => parseFloat(v))
                // x interpolated to ~mid (0 → 400, eased 0.5).
                expect(tx, "x is roughly midway").to.be.closeTo(200, 40)
                // Decompose rotation from matrix(a,b,...). Should be ~45deg
                // from the user's rotate; clobbering would give ~0deg.
                const angle = (Math.atan2(b, a) * 180) / Math.PI
                expect(
                    angle,
                    "user rotate (45deg) survived alongside the arc"
                ).to.be.closeTo(45, 12)
            })
    })
})
