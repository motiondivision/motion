/**
 * Items are 80px wide with an 8px right margin inside a list with 8px
 * padding, so item i is laid out at left = 8 + i * 88.
 */
const items = ["one", "two", "three", "four", "five"]

function expectItemsAtOrigin(width: number) {
    cy.viewport(width, 660).wait(200)
    items.forEach((item, i) => {
        cy.get(`#${item}`).then(([$item]: any) => {
            const label = `${item} at ${width}px`
            expect($item.getBoundingClientRect().left, label).to.equal(
                8 + i * 88
            )
            expect(getComputedStyle($item).zIndex, label).to.equal("auto")
        })
    })
}

describe("Reorder.Item with ref dragConstraints", () => {
    it("Items at their origin stay there when the window resizes", () => {
        cy.viewport(1200, 660)
            .visit("?test=reorder-ref-constraints-resize")
            .wait(200)
        expectItemsAtOrigin(1200)
        expectItemsAtOrigin(500)
        expectItemsAtOrigin(1000)
    })

    it("Clicking an item after a resize selects that item", () => {
        cy.viewport(1200, 660)
            .visit("?test=reorder-ref-constraints-resize")
            .wait(200)
        cy.viewport(500, 660).wait(200)

        // Click the centre of where "four" is laid out
        cy.get("body").click(8 + 3 * 88 + 40, 28)
        cy.get("#selected").should("have.text", "four")
    })
})
