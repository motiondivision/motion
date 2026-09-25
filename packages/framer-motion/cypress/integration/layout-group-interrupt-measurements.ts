/**
 * Counts getBoundingClientRect reads of #button when toggling #expander
 * re-measures #text-wrapper. #button is in its own LayoutGroup, so it should
 * only be re-measured while it's layout animating.
 *
 * Clicks are dispatched natively so Cypress actionability checks don't add
 * reads.
 */
function visit() {
    cy.viewport(500, 500).visit("?test=layout-group-interrupt", {
        onBeforeLoad(win: any) {
            win.reads = {}
            const getBoundingClientRect =
                win.Element.prototype.getBoundingClientRect
            win.Element.prototype.getBoundingClientRect = function () {
                if (this.id) win.reads[this.id] = (win.reads[this.id] || 0) + 1
                return getBoundingClientRect.call(this)
            }
        },
    })
    cy.wait(250)
}

function click(id: string) {
    cy.window().then((win: any) => {
        win.reads = {}
        win.document.getElementById(id).click()
    })
    cy.wait(300)
}

function expectReads(id: string, count: number) {
    cy.window().then((win: any) => {
        expect(win.reads[id] || 0).to.equal(count)
    })
}

describe(`LayoutGroup inherit="id" measurements`, () => {
    it("doesn't re-measure a relative child that isn't animating", () => {
        visit()
        click("expander")
        expectReads("text-wrapper", 2)
        expectReads("button", 0)
        click("expander")
        expectReads("text-wrapper", 2)
        expectReads("button", 0)
    })

    it("re-measures a layout-animating relative child once per parent re-layout", () => {
        visit()
        click("button")
        cy.wait(700)
        click("expander")
        expectReads("text-wrapper", 2)
        expectReads("button", 1)
        cy.wait(200)
        click("expander")
        expectReads("text-wrapper", 2)
        expectReads("button", 1)
    })
})
