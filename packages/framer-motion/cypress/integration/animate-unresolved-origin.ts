describe("Values without a base value", () => {
    it("never write undefined or NaN SVG attributes", () => {
        const points: string[] = []

        cy.visit("?test=animate-unresolved-origin", {
            onBeforeLoad(win) {
                const setAttribute = win.Element.prototype.setAttribute
                win.Element.prototype.setAttribute = function (
                    name: string,
                    value: string
                ) {
                    if (name === "points") points.push(String(value))
                    return setAttribute.call(this, name, value)
                }
            },
        })
            .wait(1000)
            .then(() => {
                expect(points.length).to.be.greaterThan(2)
                points.forEach((value) =>
                    expect(value).not.to.match(/NaN|undefined/u)
                )
            })
    })

    it("animate CSS variables from their inherited value", () => {
        cy.visit("?test=animate-unresolved-origin")
            .wait(5000)
            .get("#css-var")
            .then(([element]: any) => {
                const x = parseFloat(
                    element.ownerDocument.defaultView
                        .getComputedStyle(element)
                        .getPropertyValue("--x")
                )
                expect(x).to.be.within(65, 85)
            })
    })
})
