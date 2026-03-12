describe("SVG transform animation (#3081)", () => {
    it("Applies transform animation without other SVG attributes animated", () => {
        cy.visit("?test=svg-transform-animation")
            .wait(50)
            .get("#svg-rect")
            .should(($rect: any) => {
                const rect = $rect[0] as SVGRectElement
                // Before animation, transform should be the initial matrix(2,0,0,2,0,0)
                expect(rect.style.transform).to.contain("matrix")
            })
            .get("#animate")
            .click()
            .wait(300)
            .get("#svg-rect")
            .should(($rect: any) => {
                const rect = $rect[0] as SVGRectElement
                const transform = rect.style.transform
                // After animation, transform should be the final identity matrix
                expect(transform).to.not.equal("")
                expect(transform).to.not.equal("none")
                expect(transform).to.contain("matrix")
                const match = transform.match(/matrix\(([^)]+)\)/)
                expect(match).to.not.be.null
                const values = match![1].split(",").map(Number)
                // Identity matrix: 1, 0, 0, 1, 0, 0
                expect(values[0]).to.be.closeTo(1, 0.1)
                expect(values[3]).to.be.closeTo(1, 0.1)
            })
            .get("#svg-g")
            .should(($g: any) => {
                const g = $g[0] as SVGGElement
                const transform = g.style.transform
                expect(transform).to.not.equal("")
                expect(transform).to.not.equal("none")
                expect(transform).to.contain("matrix")
            })
            .get("#svg-root")
            .should(($svg: any) => {
                const svg = $svg[0] as SVGSVGElement
                const transform = svg.style.transform
                // motion.svg treats transforms like HTML (rotate builds to "none" at 0deg)
                expect(transform).to.not.equal("")
            })
    })
})
