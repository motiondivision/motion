interface Measurement {
    top: number
    left: number
    offsetTop: number
}

function measure(doc: Document): Measurement {
    const button = doc.getElementById("button")!.getBoundingClientRect()
    const parent = doc.getElementById("text-wrapper")!.getBoundingClientRect()
    return {
        top: button.top,
        left: button.left,
        offsetTop: button.top - parent.top,
    }
}

describe(`LayoutGroup inherit="id"`, () => {
    it("relative child follows its parent when a parent layout change interrupts its own layout animation", () => {
        cy.viewport(500, 500).visit("?test=layout-group-interrupt").wait(250)

        let initial: Measurement
        let before: Measurement
        cy.document().then((doc) => {
            initial = measure(doc)
        })

        cy.get("#button").click()

        // Wait until #button is part-way through its own 110px animation
        cy.document().should((doc) => {
            expect(measure(doc).top - initial.top).to.be.within(20, 90)
        })

        /**
         * #text-wrapper is re-measured, #button isn't. #button should
         * neither jump by #text-wrapper's 75px layout shift nor skip the
         * rest of its own horizontal animation within #text-wrapper.
         */
        const toggleExpander = () => {
            cy.document().then((doc) => {
                before = measure(doc)
            })
            cy.get("#expander").click().nextFrame()
            cy.document().then((doc) => {
                const after = measure(doc)
                expect(Math.abs(after.top - before.top)).to.be.lessThan(20)
                expect(Math.abs(after.left - before.left)).to.be.lessThan(10)
                expect(after.offsetTop).to.be.closeTo(initial.offsetTop, 1)
            })
        }

        toggleExpander()
        cy.wait(500)
        toggleExpander()
        cy.wait(500)
        cy.document().then((doc) => {
            expect(measure(doc).offsetTop).to.be.closeTo(initial.offsetTop, 1)
        })
    })
})
