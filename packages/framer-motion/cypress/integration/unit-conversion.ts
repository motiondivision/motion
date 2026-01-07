describe("Unit conversion", () => {
    /**
     * Test for GitHub issue #3410
     * When animating from a calc() with CSS variables to a simple value (and back),
     * the animation should complete correctly without getting stuck at intermediate values.
     */
    it("Animate x roundtrip: 0 -> calc -> 0", () => {
        // Helper to extract translateX value from computed transform matrix
        const getTranslateX = (element: HTMLElement): number => {
            const style = window.getComputedStyle(element)
            const matrix = new DOMMatrix(style.transform)
            return matrix.m41 // translateX is in m41
        }

        cy.visit("?test=unit-conversion&roundtrip=true")
            .wait(200)
            .get("#box")
            .should(([$box]: any) => {
                // Initial position should be 0
                expect(getTranslateX($box)).to.equal(0)
            })
            // First click: 0 -> calc(3 * var(--width)) = 300px
            .trigger("click")
            .wait(300)
            .should(([$box]: any) => {
                expect(getTranslateX($box)).to.equal(300)
            })
            // Second click: calc(300px) -> 0
            .trigger("click")
            .wait(300)
            .should(([$box]: any) => {
                // After animation back to 0
                expect(getTranslateX($box)).to.equal(0)
            })
    })

    it("Animate x from 0 to calc", () => {
        cy.visit("?test=unit-conversion")
            .wait(100)
            .get("#box")
            .trigger("click")
            .wait(100)
            .should(([$box]: any) => {
                const { left } = $box.getBoundingClientRect()
                expect(left).to.equal(150)
            })
    })

    it("Animate x from 0 to calc with externally-defined motion value", () => {
        cy.visit("?test=unit-conversion&use-motion-value=true")
            .wait(100)
            .get("#box")
            .trigger("click")
            .wait(100)
            .should(([$box]: any) => {
                const { left } = $box.getBoundingClientRect()
                expect(left).to.equal(150)
            })
    })

    it("Animate width and height to/from vh units", () => {
        cy.viewport(400, 400)
            .visit("?test=unit-conversion-vh")
            .wait(100)
            .get("#box")
            .should(([$box]: any) => {
                const { width, height } = $box.getBoundingClientRect()
                expect(width).to.equal(150)
                expect(height).to.equal(150)
            })
    })

    it("Restores unapplied transforms", () => {
        cy.viewport(400, 400)
            .visit("?test=unit-conversion-rotate")
            .wait(300)
            .get("#box")
            .should(([$box]: any) => {
                const { transform } = $box.style
                expect(transform).to.equal("rotate(45deg)")
                expect($box.textContent).to.equal("Success")
            })
    })

    it("Coerces none keyframes before measuring", () => {
        cy.viewport(400, 400)
            .visit("?test=unit-conversion-to-zero")
            .wait(100)
            .get("#box")
            .should(([$box]: any) => {
                const { top } = $box.getBoundingClientRect()
                expect(top).to.equal(100)
            })
    })
})
