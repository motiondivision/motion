describe("native numeric properties and layout", () => {
    beforeEach(() => {
        cy.visit("?test=waapi-numeric-layout", {
            onBeforeLoad(win) {
                cy.spy(win.Element.prototype, "animate").as("nativeAnimate")
            },
        })
    })

    it("animates numeric dimensions and radius natively with correct units", () => {
        cy.get("#animate").click().wait(100)
        cy.get("@nativeAnimate").then((spy: any) => {
            const calls = spy
                .getCalls()
                .filter((call: any) => call.thisValue.id === "numeric")
            expect(calls.length).to.equal(3)
            expect(
                calls.map((call: any) => Object.keys(call.args[0])[0]).sort()
            ).to.deep.equal(["borderRadius", "height", "width"])
        })
        cy.window().then((win: any) => {
            win.numericAnimation.time = 0.5
        })
        cy.wait(50)
            .get("#numeric")
            .then(([$element]: any) => {
                const style = getComputedStyle($element)
                expect(parseFloat(style.width)).to.equal(150)
                expect(parseFloat(style.height)).to.equal(120)
                expect(parseFloat(style.borderTopLeftRadius)).to.equal(30)
            })
        cy.window().then((win: any) => {
            win.numericAnimation.complete()
        })
        cy.wait(50)
            .get("#numeric")
            .then(([$element]: any) => {
                expect($element.style.width).to.equal("200px")
                expect($element.style.height).to.equal("160px")
                expect($element.style.borderRadius).to.equal("40px")
            })
    })

    it("keeps radius correction on JS for layout, layoutId and nested projection", () => {
        cy.get("#layout").click().wait(500)
        cy.get("@nativeAnimate").then((spy: any) => {
            const calls = spy
                .getCalls()
                .filter((call: any) =>
                    ["own-layout", "shared-layout", "nested-layout"].includes(
                        call.thisValue.id
                    )
                )
            expect(calls.length).to.equal(0)
        })
        for (const id of ["own-layout", "shared-layout", "nested-layout"]) {
            cy.get(`#${id}`).then(([$element]: any) => {
                const style = getComputedStyle($element)
                expect(style.transform).not.to.equal("none")
                expect(style.borderTopLeftRadius).to.contain("%")
                expect(
                    $element.getBoundingClientRect().width
                ).to.be.greaterThan(100)
                expect($element.getBoundingClientRect().width).to.be.lessThan(
                    200
                )
            })
        }
    })
})
