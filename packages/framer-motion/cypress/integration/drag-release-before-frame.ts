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

function nextFrame() {
    return cy
        .window({ log: false })
        .then(
            (win) =>
                new Cypress.Promise<void>((resolve) =>
                    win.requestAnimationFrame(() => resolve())
                )
        )
}

function startDrag() {
    let start: DOMRect

    cy.visit("?test=drag-release-before-frame").get("[data-testid='draggable']")
    /**
     * Wait for React 19 StrictMode's post-paint remount, which would
     * otherwise end a gesture started on the first frame.
     */
    nextFrame()
    nextFrame()
    cy.get("[data-testid='draggable']").then(([el]) => {
        start = el.getBoundingClientRect()
        pointer(el, "pointerdown", start.left + 5, start.top + 5)
        pointer(el, "pointermove", start.left + 15, start.top + 15)
    })
    nextFrame()
    nextFrame()
    cy.get("[data-testid='draggable']").then(([el]) => {
        const { left, top } = el.getBoundingClientRect()
        expect(left - start.left, "x offset after first move").to.equal(10)
        expect(top - start.top, "y offset after first move").to.equal(10)
    })

    return () => start
}

function expectRestingAt(getStart: () => DOMRect, x: number, y: number) {
    nextFrame()
    nextFrame()
    cy.get("#drag-end-offset").should("have.text", `${x},${y}`)
    cy.get("[data-testid='draggable']").then(([el]) => {
        const start = getStart()
        const { left, top } = el.getBoundingClientRect()
        expect(left - start.left, "x offset at rest").to.equal(x)
        expect(top - start.top, "y offset at rest").to.equal(y)
    })
}

describe("Drag release before the next frame", () => {
    it("Applies a pointermove followed by pointerup within the same frame", () => {
        const getStart = startDrag()

        cy.get("[data-testid='draggable']").then(([el]) => {
            const start = getStart()
            pointer(el, "pointermove", start.left + 105, start.top + 105)
            pointer(el, "pointerup", start.left + 105, start.top + 105)
        })

        expectRestingAt(getStart, 100, 100)
    })

    it("Applies a pointermove when a frame runs before pointerup", () => {
        const getStart = startDrag()

        cy.get("[data-testid='draggable']").then(([el]) => {
            const start = getStart()
            pointer(el, "pointermove", start.left + 105, start.top + 105)
        })
        nextFrame()
        cy.get("[data-testid='draggable']").then(([el]) => {
            const start = getStart()
            pointer(el, "pointerup", start.left + 105, start.top + 105)
        })

        expectRestingAt(getStart, 100, 100)
    })
})
