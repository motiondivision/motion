/**
 * Composes the element's rendered transform from the individual translate,
 * rotate and scale properties and the transform shorthand, in the order the
 * browser applies them. Accelerated transforms render through the individual
 * properties, so the shorthand alone doesn't describe the element. Browsers
 * without the individual properties report them as undefined.
 */
const readTransform = (element: HTMLElement) => {
    const { translate, rotate, scale, transform } = getComputedStyle(element)
    const isSet = (value?: string) => value && value !== "none"
    let matrix = new DOMMatrix()

    if (isSet(translate)) {
        const [x, y = "0"] = translate.split(" ")
        matrix = matrix.translate(parseFloat(x), parseFloat(y))
    }
    if (isSet(rotate)) {
        matrix = matrix.rotate(parseFloat(rotate))
    }
    if (isSet(scale)) {
        const [x, y = x] = scale.split(" ")
        matrix = matrix.scale(parseFloat(x), parseFloat(y))
    }

    return matrix.multiply(new DOMMatrix(transform))
}

describe("animate() x read transform value", () => {
    it("correctly reads and animates transform values", () => {
        cy.visit("?test=animate-read-transform")
            .wait(500)
            .get(".translate")
            .should(($el) => {
                const { m41, m42 } = readTransform($el[0])
                expect(m41).to.be.closeTo(150, 0.5)
                expect(m42).to.be.closeTo(150, 0.5)
            })

        cy.get(".rotate").should(($el) => {
            const { a, b } = readTransform($el[0])
            const angle = (Math.atan2(b, a) * 180) / Math.PI
            expect(angle).to.be.closeTo(95, 0.5)
        })

        cy.get(".scale").should(($el) => {
            const { a, d } = readTransform($el[0])
            expect(a).to.be.closeTo(3, 0.01)
            expect(d).to.be.closeTo(3, 0.01)
        })
    })
})
