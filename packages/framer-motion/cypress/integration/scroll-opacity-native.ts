describe("scroll-driven opacity animation", () => {
    it("Opacity animates from 0 to 1 when scrolling with native timeline", () => {
        cy.visit("?test=scroll-opacity-native")
            .wait(200)
            .get("#target")
            .should(([$el]: any) => {
                // At scroll top, opacity should be near 0
                const opacity = parseFloat(getComputedStyle($el).opacity)
                expect(opacity).to.be.lessThan(0.15)
            })
        cy.scrollTo("bottom", { duration: 100 })
            .wait(200)
            .get("#target")
            .should(([$el]: any) => {
                // At scroll bottom, opacity should be near 1
                const opacity = parseFloat(getComputedStyle($el).opacity)
                expect(opacity).to.be.greaterThan(0.9)
            })
    })

    it("Scale animates correctly alongside opacity", () => {
        cy.visit("?test=scroll-opacity-native")
            .wait(200)
            .get("#target")
            .should(([$el]: any) => {
                const transform = getComputedStyle($el).transform
                // At scroll top, scale should be ~0.5
                // matrix(0.5, 0, 0, 0.5, 0, 0)
                if (transform && transform !== "none") {
                    const match = transform.match(/matrix\(([^,]+)/)
                    if (match) {
                        const scaleValue = parseFloat(match[1])
                        expect(scaleValue).to.be.lessThan(0.65)
                    }
                }
            })
        cy.scrollTo("bottom", { duration: 100 })
            .wait(200)
            .get("#target")
            .should(([$el]: any) => {
                const transform = getComputedStyle($el).transform
                // At scroll bottom, scale should be ~1
                if (transform && transform !== "none") {
                    const match = transform.match(/matrix\(([^,]+)/)
                    if (match) {
                        const scaleValue = parseFloat(match[1])
                        expect(scaleValue).to.be.greaterThan(0.9)
                    }
                }
            })
    })
})
