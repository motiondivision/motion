/**
 * Release velocity only looks at the last 100ms of pointer history, and
 * PanSession applies each pointermove on the next animation frame. Separate
 * cy.trigger() calls can be >100ms apart on slow CI, so the throw is
 * dispatched directly: final pointermove, one frame, then pointerup.
 */
function dispatchPointer(el: HTMLElement, type: string, clientY: number) {
    const win = el.ownerDocument.defaultView as any
    el.dispatchEvent(
        new win.PointerEvent(type, {
            clientX: el.getBoundingClientRect().left + 25,
            clientY,
            pointerId: 1,
            pointerType: "mouse",
            isPrimary: true,
            button: 0,
            bubbles: true,
            cancelable: true,
        })
    )
}

function afterFrame(el: HTMLElement) {
    return new Cypress.Promise((resolve: () => void) =>
        (el.ownerDocument.defaultView as any).requestAnimationFrame(() =>
            resolve()
        )
    )
}

function flick(el: HTMLElement, clientY: number) {
    dispatchPointer(el, "pointermove", clientY)
    return afterFrame(el).then(() => dispatchPointer(el, "pointerup", clientY))
}

const topOf = (el: HTMLElement) => el.getBoundingClientRect().top

describe("Drag Momentum", () => {
    it("Fast flick after hold produces momentum", () => {
        let startTop = 0
        cy.visit("?test=drag-momentum")
            .wait(200)
            .get("[data-testid='draggable']")
            .wait(200)
            .nextFrame()
            .nextFrame()
            .then(([el]: any) => {
                startTop = topOf(el)
                dispatchPointer(el, "pointerdown", startTop + 900)
            })
            .wait(300) // Simulate holding before flick
            .then(([el]: any) => {
                // Cross distance threshold
                dispatchPointer(el, "pointermove", startTop + 895)
            })
            .nextFrame() // Start the pan before the flick
            .wait(50)
            .then(([el]: any) => flick(el, startTop + 800)) // Quick flick upward
            .wait(500) // Wait for momentum to carry element
            .should(([el]: any) => {
                // Element should have carried well past the release point
                // due to momentum. Without the fix, velocity is diluted by
                // the stale pointer-down point and momentum is minimal.
                expect(topOf(el)).to.be.lessThan(-200)
            })
    })

    it("Catch-and-release stops momentum", () => {
        let startTop = 0
        let releasedTop = 0
        let caughtTop = 0
        cy.visit("?test=drag-momentum")
            .wait(200)
            .get("[data-testid='draggable']")
            .wait(200)
            .nextFrame()
            .nextFrame()
            // Perform a drag-and-throw upward
            .then(([el]: any) => {
                startTop = topOf(el)
                dispatchPointer(el, "pointerdown", startTop + 900)
                dispatchPointer(el, "pointermove", startTop + 895) // Cross distance threshold
            })
            .nextFrame() // Start the pan before the flick
            .wait(50)
            .then(([el]: any) =>
                flick(el, startTop + 700).then(() => {
                    releasedTop = topOf(el)
                })
            )
            // Wait until momentum is visibly carrying the element, or the
            // catch is untested
            .get("[data-testid='draggable']")
            .should(([el]: any) => {
                expect(releasedTop - topOf(el)).to.be.greaterThan(20)
            })
            // Catch. Pointerdown stops the animation, which renders its
            // final value on the next frame.
            .then(([el]: any) => {
                dispatchPointer(el, "pointerdown", startTop + 500)
                return afterFrame(el).then(() => {
                    caughtTop = topOf(el)
                })
            })
            .wait(50)
            .then(([el]: any) =>
                dispatchPointer(el, "pointerup", startTop + 500)
            )
            .wait(500) // Wait to see if element continues moving
            .should(([el]: any) => {
                // Element should stay near where it was caught,
                // not continue with old momentum.
                expect(Math.abs(topOf(el) - caughtTop)).to.be.lessThan(50)
            })
    })
})
