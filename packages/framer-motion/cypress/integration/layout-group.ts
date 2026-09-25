/**
 * The button's top is recorded on every animation frame, so the "doesn't
 * jump" checks see every rendered position rather than a single sample
 * taken after a fixed wait, which slow CI can overshoot.
 */
const buttonTop = (button: HTMLElement) =>
    Math.round(button.getBoundingClientRect().top)

function recordButtonTops() {
    const tops: number[] = []
    cy.get("#button").then(([button]) => {
        const win = button.ownerDocument.defaultView!
        const record = () => {
            tops.push(buttonTop(button))
            win.requestAnimationFrame(record)
        }
        record()
    })
    return tops
}

/**
 * Unrounded, so this waits for the layout animation to finish rather than
 * its eased tail.
 */
function expectButtonToSettleAt(top: number) {
    cy.get("#button").should(([button]) => {
        expect(button.getBoundingClientRect().top).to.equal(top)
    })
}

function expectFramesBetween(tops: number[], from: number, to: number) {
    const between = tops.filter((top) => top !== from && top !== to)
    expect(between, `frames other than ${from} and ${to}: ${tops}`).not.to.be
        .empty
}

describe(`LayoutGroup inherit="id"`, () => {
    it("relative children should not instantly jump to new layout", () => {
        cy.viewport(500, 500).visit("?test=layout-group").wait(250)

        const tops = recordButtonTops()
        cy.get("#expander").click()
        expectButtonToSettleAt(104)

        // Should have rendered positions between the original and final
        cy.then(() => expectFramesBetween(tops, tops[0], 104))
    })

    it("relative children should not instantly jump to new layout, after performing their own layout animation", () => {
        cy.viewport(500, 500).visit("?test=layout-group").wait(250)

        // Click button first and let it finish its own layout animation
        cy.get("#button").click()
        expectButtonToSettleAt(129)

        const tops = recordButtonTops()
        cy.get("#expander").click()
        expectButtonToSettleAt(204)

        cy.then(() => expectFramesBetween(tops, 129, 204))
    })

    it("should return to original state when expander is clicked twice with delay", () => {
        cy.viewport(500, 500).visit("?test=layout-group").wait(250)

        const tops = recordButtonTops()
        cy.get("#expander").click()

        // Click the expander again once the button is mid-animation
        cy.wrap(tops).should(() => expectFramesBetween(tops, tops[0], 104))
        cy.wait(50).get("#expander").click()

        // Should be back to original state
        cy.then(() => expectButtonToSettleAt(tops[0]))
    })
})
