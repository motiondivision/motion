function pointer(el: Element, type: string, x: number, y: number) {
    const win = el.ownerDocument.defaultView as any
    el.dispatchEvent(
        new win.PointerEvent(type, {
            clientX: x,
            clientY: y,
            isPrimary: true,
            bubbles: true,
            pointerId: 1,
            button: 0,
            pointerType: "mouse",
        })
    )
}

describe("Reorder release before the next frame", () => {
    it("Reorders when the final move arrives in the same frame as pointerup", () => {
        let tomato: DOMRect
        let cucumber: DOMRect

        cy.visit("?test=drag-to-reorder")
            .get("#Cucumber")
            .then(([el]) => {
                cucumber = el.getBoundingClientRect()
            })
            .get("#Tomato")
            .nextFrame()
            .nextFrame()
            .then(([el]) => {
                tomato = el.getBoundingClientRect()
                const x = tomato.left + 10
                pointer(el, "pointerdown", x, tomato.top + 10)
                pointer(el, "pointermove", x, tomato.top + 15)
            })
            .nextFrame()
            .then(([el]) => {
                pointer(el, "pointermove", tomato.left + 10, tomato.top + 35)
            })
            .nextFrame()
            .then(([el]) => {
                // 55px down: past Cucumber's centre, released within the frame
                const y = tomato.top + 65
                pointer(el, "pointermove", tomato.left + 10, y)
                pointer(el, "pointerup", tomato.left + 10, y)
            })
            .get("#Tomato")
            .should(([el]) => {
                const ids = [...el.parentElement!.children]
                    .map((child) => child.id)
                    .filter(Boolean)
                expect(ids.slice(0, 2)).to.deep.equal(["Cucumber", "Tomato"])
                expect(el.getBoundingClientRect().top).to.be.closeTo(
                    cucumber.top,
                    2
                )
            })
            .get("#Cucumber")
            .should(([el]) => {
                expect(el.getBoundingClientRect().top).to.be.closeTo(
                    tomato.top,
                    2
                )
            })
    })
})
