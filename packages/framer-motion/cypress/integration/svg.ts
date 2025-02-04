describe("SVG", () => {
    it("Correctly applies transforms", () => {
        cy.visit("?test=svg")
            .wait(200)
            .get("[data-testid='rotate']")
            .should(($rotate: any) => {
                const rotate = $rotate[0] as SVGRectElement
                const { top, left, right, bottom } =
                    rotate.getBoundingClientRect()
                expect(Math.round(top)).to.equal(29)
                expect(Math.round(left)).to.equal(29)
                expect(Math.round(right)).to.equal(171)
                expect(Math.round(bottom)).to.equal(171)
            })
            .get("[data-testid='scale']")
            .should(($scale: any) => {
                const scale = $scale[0] as SVGRectElement
                const { top, left, right, bottom } =
                    scale.getBoundingClientRect()
                expect(top).to.equal(150)
                expect(left).to.equal(0)
                expect(right).to.equal(200)
                expect(bottom).to.equal(350)
            })
            .get("[data-testid='translate']")
            .should(($translate: any) => {
                const translate = $translate[0] as SVGRectElement
                const { top, left, right, bottom } =
                    translate.getBoundingClientRect()
                expect(top).to.equal(350)
                expect(left).to.equal(150)
                expect(right).to.equal(250)
                expect(bottom).to.equal(450)
            })
    })
    it("Correctly applies transforms in static mode", () => {
        cy.visit("?test=svg&isStatic=true")
            .wait(200)
            .get("[data-testid='rotate']")
            .should(($rotate: any) => {
                const rotate = $rotate[0] as SVGRectElement
                const { top, left, right, bottom } =
                    rotate.getBoundingClientRect()
                expect(Math.round(top)).to.equal(29)
                expect(Math.round(left)).to.equal(29)
                expect(Math.round(right)).to.equal(171)
                expect(Math.round(bottom)).to.equal(171)
            })
            .get("[data-testid='scale']")
            .should(($scale: any) => {
                const scale = $scale[0] as SVGRectElement
                const { top, left, right, bottom } =
                    scale.getBoundingClientRect()
                expect(top).to.equal(150)
                expect(left).to.equal(0)
                expect(right).to.equal(200)
                expect(bottom).to.equal(350)
            })
            .get("[data-testid='translate']")
            .should(($translate: any) => {
                const translate = $translate[0] as SVGRectElement
                const { top, left, right, bottom } =
                    translate.getBoundingClientRect()
                expect(top).to.equal(350)
                expect(left).to.equal(150)
                expect(right).to.equal(250)
                expect(bottom).to.equal(450)
            })
    })

    it("Correctly animates to CSS variables", () => {
        cy.visit("?test=svg-css-vars")
            .wait(50)
            .get("svg")
            .click()
            .wait(50)
            .get("circle")
            .should(([$circle]: any) => {
                expect($circle.getAttribute("fill")).to.equal(
                    "rgba(180, 0, 180, 1)"
                )
            })
    })
})

describe("SVG origin", () => {
    it("Correctly animates origin", () => {
        cy.visit("?test=svg-origin")
            .wait(500)
            .get("circle")
            .should(([$circle]: any) => {
                expect($circle.style.transformOrigin).to.equal("100px 100px")
                expect($circle.style.transform).to.equal("scale(0.5)")
            })
            .get("rect")
            .should(([$rect]: any) => {
                expect($rect.style.transformOrigin).to.equal("300px 150px")
                expect($rect.style.transform).to.equal("scale(0.5)")
            })
            .get("#new-transform")
            .should(([$circle]: any) => {
                expect($circle.style.transformOrigin).to.equal("400px 100px")
                expect($circle.style.transform).to.equal("scale(0.5)")
            })
    })
})

describe("SVG measures", () => {
    it("Correctly measures SVG and renders on mount", () => {
        cy.visit("?test=svg-initial-render")
            .wait(200)
            .get("path")
            .should(([$path]: any) => {
                expect($path.style.transform).to.equal(
                    "translateX(5px) translateY(5px)"
                )
                expect($path.style.transformOrigin).to.equal("20px 20px")
            })
    })

    it("Measure SVG and renders on mount when encountering new transforms", () => {
        cy.visit("?test=svg-animate-transform")
            .wait(200)
            .get("path")
            .should(([$path]: any) => {
                expect($path.style.transform).to.equal(
                    "translateX(5px) translateY(5px)"
                )
                expect($path.style.transformOrigin).to.equal("20px 20px")
            })
    })
})
